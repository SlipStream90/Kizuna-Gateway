"""Query embedding → pgvector cosine search → formatted clause citations."""

from typing import Sequence

from app.rag.citations import Lang, citation_index, format_citation, to_badge
from app.rag.embeddings import Embedder, HashingEmbedder
from app.rag.repository import StatutoryChunkRepository, StatutoryHit
from app.schemas.statutes import StatuteHit, StatuteSearchRequest, StatuteSearchResponse


def to_results(hits: Sequence[StatutoryHit], lang: Lang) -> list[StatuteHit]:
    return [
        StatuteHit(
            id=h.id, document_code=h.document_code, document_title=h.document_title, authority=h.authority,
            clause_reference=h.clause_reference, citation_id=h.citation_id,
            citation=format_citation(h.document_short_title, h.clause_reference, lang),
            similarity=round(h.similarity, 4), content=h.content, hierarchy=h.hierarchy,
            page_start=h.page_start, page_end=h.page_end, source_url_or_file=h.source_url_or_file,
            last_verified_date=h.last_verified_date, badge=to_badge(h, h.similarity),
        )
        for h in hits
    ]


def is_semantic(embedder: Embedder) -> bool:
    return not isinstance(embedder, HashingEmbedder)


def search_statutes(
    request: StatuteSearchRequest, repository: StatutoryChunkRepository, embedder: Embedder
) -> StatuteSearchResponse:
    vector = embedder.embed_query(request.query)
    hits = repository.search(vector, embedder.model_name, request.k, request.document_codes, request.min_similarity)
    return StatuteSearchResponse(
        query=request.query,
        embedding_model=embedder.model_name,
        semantic=is_semantic(embedder),
        results=to_results(hits, request.lang),
        citation_index=citation_index(hits, request.lang),
    )
