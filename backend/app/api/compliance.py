from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from app.auth.dependencies import require_principal
from app.api.assessments import _repository
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import ComplianceSearchResult, Principal
from app.rag.embeddings import Embedder, get_embedder
from app.rag.repository import StatutoryChunkRepository
from app.rag.answer import AnswerModel, answer_question, get_answer_model
from app.rag.search import search_statutes
from app.schemas.statutes import StatuteAnswerRequest, StatuteAnswerResponse, StatuteSearchRequest, StatuteSearchResponse
router=APIRouter(prefix='/compliance',tags=['compliance'])
@router.get('/search',response_model=ComplianceSearchResult)
def compliance_search(assessment_id: UUID, q: str = Query(min_length=1, max_length=500),
                      principal: Principal = Depends(require_principal), repository: PilotRepository = Depends(_repository)):
 return repository.compliance_search(assessment_id, q, principal.org_id)


def _statute_repository(request: Request) -> StatutoryChunkRepository:
    return StatutoryChunkRepository(request.app.state.db_pool)


def _embedder() -> Embedder:
    try:
        return get_embedder()
    except RuntimeError as exc:  # model not installed / dimension mismatch
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from None


@router.post('/search', response_model=StatuteSearchResponse)
def statute_search(payload: StatuteSearchRequest, repository: StatutoryChunkRepository = Depends(_statute_repository),
                   embedder: Embedder = Depends(_embedder)):
    """Semantic search over ingested statutes, returning exact clause references and cosine similarity.

    The GET variant above remains the assessment-scoped search over curated passages.
    """
    return search_statutes(payload, repository, embedder)


def _answer_model() -> AnswerModel | None:
    return get_answer_model()


@router.post('/answer', response_model=StatuteAnswerResponse)
def statute_answer(payload: StatuteAnswerRequest, repository: StatutoryChunkRepository = Depends(_statute_repository),
                   embedder: Embedder = Depends(_embedder), model: AnswerModel | None = Depends(_answer_model)):
    """RAG answer restricted to retrieved clauses; every paragraph cites them.

    Always returns the retrieved clauses; `status` says whether an answer was generated
    (`answered`), withheld for weak evidence, unavailable (no model/credentials) or refused.
    """
    return answer_question(payload, repository, embedder, model)
