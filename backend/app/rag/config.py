"""Environment-driven settings for the statutory RAG engine."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# Must match the vector(...) column in migrations/003_statutory_chunks.sql.
VECTOR_DIMENSIONS = 384

DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@dataclass(frozen=True)
class RagSettings:
    """`embedding_backend` is 'sentence-transformers' (default) or 'hashing' (tests/offline only)."""

    embedding_backend: str
    embedding_model: str
    documents_dir: Path
    max_chunk_chars: int


@lru_cache
def rag_settings() -> RagSettings:
    backend = os.getenv("RAG_EMBEDDING_BACKEND", "sentence-transformers").strip().lower()
    if backend not in {"sentence-transformers", "hashing"}:
        raise ValueError(f"Unsupported RAG_EMBEDDING_BACKEND: {backend!r}")
    return RagSettings(
        embedding_backend=backend,
        embedding_model=os.getenv("RAG_EMBEDDING_MODEL", DEFAULT_MODEL),
        documents_dir=Path(os.getenv("RAG_DOCUMENTS_DIR", "data/documents")),
        max_chunk_chars=int(os.getenv("RAG_MAX_CHUNK_CHARS", "2400")),
    )
