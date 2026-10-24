"""pgvector persistence for statutory chunks."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Sequence
from uuid import UUID

from psycopg import Connection
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.rag.chunking import StatutoryChunk


def vector_literal(values: Sequence[float]) -> str:
    """pgvector text format; avoids a driver adapter dependency."""
    return "[" + ",".join(f"{v:.7g}" for v in values) + "]"


@dataclass(frozen=True)
class StatutoryHit:
    id: UUID
    document_code: str
    document_title: str
    document_short_title: str
    authority: str
    clause_reference: str
    citation_id: str
    hierarchy: dict[str, Any]
    content: str
    source_url_or_file: str
    page_start: int | None
    page_end: int | None
    last_verified_date: datetime | None
    similarity: float


_COLUMNS = (
    "document_code, document_title, document_short_title, authority, reference_style, clause_reference, "
    "citation_id, hierarchy, chunk_index, content, content_hash, embedding, embedding_model, "
    "source_url_or_file, page_start, page_end, last_verified_date"
)


def replace_document(
    conn: Connection, chunks: Sequence[StatutoryChunk], embeddings: Sequence[Sequence[float]], model: str
) -> int:
    """Atomically replace every chunk of the document(s) in `chunks` (idempotent re-ingest)."""
    if len(chunks) != len(embeddings):
        raise ValueError("chunks and embeddings must align")
    codes = sorted({c.document_code for c in chunks})
    with conn.transaction():
        conn.execute("DELETE FROM statutory_chunks WHERE document_code = ANY(%s)", (codes,))
        with conn.cursor() as cur:
            cur.executemany(
                f"INSERT INTO statutory_chunks ({_COLUMNS}) VALUES "
                "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector,%s,%s,%s,%s,%s)",
                [
                    (
                        c.document_code, c.document_title, c.document_short_title, c.authority, c.reference_style,
                        c.clause_reference, c.citation_id, Jsonb(c.hierarchy), c.chunk_index, c.content,
                        c.content_hash, vector_literal(e), model, c.source_url_or_file, c.page_start, c.page_end,
                        c.last_verified_date,
                    )
                    for c, e in zip(chunks, embeddings)
                ],
            )
    return len(chunks)


_ITERATIVE_SCAN: bool | None = None


def _tune_hnsw(conn: Connection) -> None:
    """Keep filtered searches (by model / document) from returning fewer than k rows.

    HNSW returns `ef_search` candidates *before* WHERE filters apply; pgvector >= 0.8
    can keep scanning until enough rows pass (`iterative_scan`). Older versions reject
    that setting, so it is only set when supported.
    """
    global _ITERATIVE_SCAN
    if _ITERATIVE_SCAN is None:
        row = conn.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'").fetchone()
        major_minor = tuple(int(x) for x in row[0].split(".")[:2]) if row else (0, 0)
        _ITERATIVE_SCAN = major_minor >= (0, 8)
    conn.execute("SET LOCAL hnsw.ef_search = 100")
    if _ITERATIVE_SCAN:
        conn.execute("SET LOCAL hnsw.iterative_scan = 'relaxed_order'")


class StatutoryChunkRepository:
    """Read side used by the API; one short read-only transaction per search."""

    def __init__(self, pool: ConnectionPool):
        self._pool = pool

    def search(
        self,
        query_embedding: Sequence[float],
        model: str,
        k: int = 5,
        document_codes: Sequence[str] | None = None,
        min_similarity: float | None = None,
    ) -> list[StatutoryHit]:
        vec = vector_literal(query_embedding)
        where = ["embedding_model = %(model)s"]
        params: dict[str, Any] = {"vec": vec, "model": model, "k": k}
        if document_codes:
            where.append("document_code = ANY(%(codes)s)")
            params["codes"] = list(document_codes)
        sql = (
            "SELECT id, document_code, document_title, document_short_title, authority, clause_reference, "
            "citation_id, hierarchy, content, source_url_or_file, page_start, page_end, last_verified_date, "
            "1 - (embedding <=> %(vec)s::vector) AS similarity "
            f"FROM statutory_chunks WHERE {' AND '.join(where)} "
            # Order by the raw distance expression so the HNSW index is usable.
            "ORDER BY embedding <=> %(vec)s::vector LIMIT %(k)s"
        )
        with self._pool.connection() as conn, conn.transaction():
            conn.execute("SET TRANSACTION READ ONLY")
            _tune_hnsw(conn)
            rows = conn.execute(sql, params).fetchall()
        hits = [StatutoryHit(*row[:13], similarity=float(row[13])) for row in rows]
        # relaxed_order iterative scans may return near-ties slightly out of order.
        hits.sort(key=lambda h: h.similarity, reverse=True)
        if min_similarity is not None:
            hits = [h for h in hits if h.similarity >= min_similarity]
        return hits

    def document_counts(self) -> list[tuple[str, str, int]]:
        with self._pool.connection() as conn, conn.transaction():
            return conn.execute(
                "SELECT document_code, document_title, count(*) FROM statutory_chunks "
                "GROUP BY document_code, document_title ORDER BY document_code"
            ).fetchall()
