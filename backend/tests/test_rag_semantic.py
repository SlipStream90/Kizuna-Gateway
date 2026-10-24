"""Checks the real multilingual model: Japanese questions must retrieve English clauses.

Opt-in (downloads ~0.5 GB on first run): RAG_SEMANTIC_TEST=1 pytest tests/test_rag_semantic.py
"""

import math
import os

import pytest

pytestmark = pytest.mark.skipif(os.environ.get("RAG_SEMANTIC_TEST") != "1", reason="set RAG_SEMANTIC_TEST=1")


def _cos(a, b):
    return sum(x * y for x, y in zip(a, b)) / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


@pytest.fixture(scope="module")
def corpus():
    pytest.importorskip("sentence_transformers")
    from app.rag.chunking import chunk_document
    from app.rag.config import DEFAULT_MODEL
    from app.rag.embeddings import SentenceTransformerEmbedder
    from tests.test_rag_chunking import ACT, RBI, RBI_TEXT, SECTION_149, pages

    embedder = SentenceTransformerEmbedder(DEFAULT_MODEL)
    chunks = chunk_document(pages(RBI_TEXT), RBI) + chunk_document(pages(SECTION_149), ACT, max_chars=200)
    vectors = embedder.embed_documents([c.embedding_text() for c in chunks])
    return embedder, chunks, vectors


def _top(corpus, query):
    embedder, chunks, vectors = corpus
    q = embedder.embed_query(query)
    return max(zip(chunks, vectors), key=lambda cv: _cos(q, cv[1]))[0].clause_reference


@pytest.mark.parametrize("query, expected", [
    ("How many days do we have to file FC-GPR after issuing shares?", "Paragraph 4.2"),
    ("外国投資家への株式発行後、FC-GPRはいつまでに提出する必要がありますか？", "Paragraph 4.2"),
    ("Does the board need a director resident in India?", "Section 149(3)"),
    ("インドに居住する取締役は必要ですか？", "Section 149(3)"),
])
def test_cross_lingual_retrieval(corpus, query, expected):
    assert _top(corpus, query) == expected
