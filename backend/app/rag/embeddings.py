"""Embedding backends.

`SentenceTransformerEmbedder` is the production path: a local multilingual model,
so Japanese queries retrieve English statutory text and nothing leaves the host.
`HashingEmbedder` is deterministic feature hashing — lexical, not semantic — for
tests and machines without the model; never present its scores as semantic.
"""

import hashlib
import math
import re
from functools import lru_cache
from typing import Protocol, Sequence

from app.rag.config import VECTOR_DIMENSIONS, rag_settings


class Embedder(Protocol):
    """Maps text to unit-length vectors of `dimensions` floats."""

    model_name: str
    dimensions: int

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class SentenceTransformerEmbedder:
    """Local sentence-transformers model (downloaded once to the HF cache)."""

    def __init__(self, model_name: str, batch_size: int = 32):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover - depends on optional install
            raise RuntimeError(
                "sentence-transformers is not installed; run `pip install -r requirements-rag.txt` "
                "or set RAG_EMBEDDING_BACKEND=hashing for offline tests."
            ) from exc
        self._model = SentenceTransformer(model_name)
        self.model_name = model_name
        # Renamed in sentence-transformers 6; keep working on both sides of the rename.
        get_dim = getattr(self._model, "get_embedding_dimension", None) or self._model.get_sentence_embedding_dimension
        self.dimensions = int(get_dim())
        self._batch_size = batch_size

    def _encode(self, texts: Sequence[str]) -> list[list[float]]:
        vectors = self._model.encode(
            list(texts), batch_size=self._batch_size, normalize_embeddings=True, show_progress_bar=False
        )
        return [v.astype(float).tolist() for v in vectors]

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return self._encode(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._encode([text])[0]


_TOKEN = re.compile(r"[a-z0-9]+|[぀-ヿ一-鿿]")


class HashingEmbedder:
    """Signed feature hashing of word unigrams and bigrams, L2-normalised."""

    model_name = "hashing-v1"

    def __init__(self, dimensions: int = VECTOR_DIMENSIONS):
        self.dimensions = dimensions

    def _vector(self, text: str) -> list[float]:
        tokens = _TOKEN.findall(text.lower())
        features = tokens + [f"{a} {b}" for a, b in zip(tokens, tokens[1:])]
        vec = [0.0] * self.dimensions
        for feature in features:
            digest = hashlib.blake2b(feature.encode(), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimensions
            vec[index] += 1.0 if digest[4] & 1 else -1.0
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]

    def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


@lru_cache
def get_embedder() -> Embedder:
    """Process-wide embedder; loading a transformer model is expensive, so do it once."""
    settings = rag_settings()
    embedder: Embedder
    if settings.embedding_backend == "hashing":
        embedder = HashingEmbedder()
    else:
        embedder = SentenceTransformerEmbedder(settings.embedding_model)
    if embedder.dimensions != VECTOR_DIMENSIONS:
        raise RuntimeError(
            f"Embedding model {embedder.model_name!r} produces {embedder.dimensions}-d vectors but "
            f"statutory_chunks.embedding is vector({VECTOR_DIMENSIONS}); add a migration before switching models."
        )
    return embedder
