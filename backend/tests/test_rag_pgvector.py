"""Real PostgreSQL + pgvector round trip. Runs only when RAG_TEST_DATABASE_URL is set, e.g.

    docker run -d -p 55432:5432 -e POSTGRES_PASSWORD=jigtest -e POSTGRES_DB=jig pgvector/pgvector:pg17
    RAG_TEST_DATABASE_URL=postgresql://postgres:jigtest@localhost:55432/jig pytest tests/test_rag_pgvector.py
"""

import os
from pathlib import Path
from uuid import uuid4

import pytest

URL = os.environ.get("RAG_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="RAG_TEST_DATABASE_URL not set")

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "003_statutory_chunks.sql"


@pytest.fixture
def schema():
    """Apply migration 003 inside a throwaway schema and drop it afterwards."""
    psycopg = pytest.importorskip("psycopg")
    name = f"rag_test_{uuid4().hex[:12]}"
    with psycopg.connect(URL, autocommit=True) as admin:
        # Extensions are database-wide; keep them in public so dropping the schema doesn't remove them.
        admin.execute("CREATE EXTENSION IF NOT EXISTS vector SCHEMA public")
        admin.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public")
        admin.execute(f"CREATE SCHEMA {name}")
    try:
        with psycopg.connect(URL, options=f"-c search_path={name},public") as conn:
            conn.execute(MIGRATION.read_text(encoding="utf-8"))
        yield name
    finally:
        with psycopg.connect(URL, autocommit=True) as admin:
            admin.execute(f"DROP SCHEMA {name} CASCADE")


def test_ingest_search_reingest_and_filters(schema):
    import psycopg
    from psycopg_pool import ConnectionPool

    from app.rag.chunking import chunk_document
    from app.rag.embeddings import HashingEmbedder
    from app.rag.repository import StatutoryChunkRepository, replace_document
    from tests.test_rag_chunking import ACT, RBI, RBI_TEXT, SECTION_149, pages

    embedder = HashingEmbedder()
    rbi = chunk_document(pages(RBI_TEXT), RBI)
    act = chunk_document(pages(SECTION_149), ACT, max_chars=200)
    options = f"-c search_path={schema},public"
    with psycopg.connect(URL, options=options) as conn:
        for chunks in (rbi, act):
            replace_document(conn, chunks, embedder.embed_documents([c.embedding_text() for c in chunks]), embedder.model_name)
        assert conn.execute("SELECT count(*) FROM statutory_chunks").fetchone()[0] == len(rbi) + len(act)
        # Re-ingesting a document replaces, never duplicates.
        replace_document(conn, rbi, embedder.embed_documents([c.embedding_text() for c in rbi]), embedder.model_name)
        assert conn.execute("SELECT count(*) FROM statutory_chunks").fetchone()[0] == len(rbi) + len(act)

    with ConnectionPool(URL, kwargs={"options": options}, min_size=1, max_size=2) as pool:
        repo = StatutoryChunkRepository(pool)
        hits = repo.search(embedder.embed_query("Form FC-GPR filed within 30 days of issue"), embedder.model_name, k=3)
        assert hits[0].citation_id == "RBI-MD-FI/Paragraph 4.2"
        assert [h.similarity for h in hits] == sorted((h.similarity for h in hits), reverse=True)
        assert 0 < hits[0].similarity <= 1

        resident = repo.search(embedder.embed_query("director who stays in India 182 days"), embedder.model_name, k=1)
        assert resident[0].clause_reference == "Section 149(3)" and resident[0].page_start == 1

        only_act = repo.search(embedder.embed_query("FC-GPR"), embedder.model_name, k=10, document_codes=["CA-2013"])
        assert {h.document_code for h in only_act} == {"CA-2013"}
        # Vectors from a different model are never mixed into results.
        assert repo.search(embedder.embed_query("FC-GPR"), "some-other-model", k=5) == []
        assert repo.document_counts() == [("CA-2013", "Companies Act, 2013", len(act)),
                                          ("RBI-MD-FI", RBI.title, len(rbi))]


def test_schema_rejects_bad_rows(schema):
    import psycopg

    with psycopg.connect(URL, options=f"-c search_path={schema},public") as conn:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(
                "INSERT INTO statutory_chunks (document_code, document_title, document_short_title, clause_reference, "
                "citation_id, chunk_index, content, content_hash, embedding, embedding_model, source_url_or_file) "
                "VALUES ('bad code!', 't', 't', 'r', 'c', 0, 'x', repeat('a', 64), %s::vector, 'm', 's')",
                ("[" + ",".join(["0"] * 384) + "]",),
            )
        conn.rollback()
        with pytest.raises(psycopg.errors.DataException):  # wrong dimension
            conn.execute(
                "INSERT INTO statutory_chunks (document_code, document_title, document_short_title, clause_reference, "
                "citation_id, chunk_index, content, content_hash, embedding, embedding_model, source_url_or_file) "
                "VALUES ('OK', 't', 't', 'r', 'c', 0, 'x', repeat('a', 64), '[1,2,3]'::vector, 'm', 's')"
            )
