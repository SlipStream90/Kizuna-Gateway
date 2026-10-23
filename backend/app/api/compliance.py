from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request
from app.auth.dependencies import require_principal
from app.api.assessments import _repository
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import ComplianceSearchResult, Principal
router=APIRouter(prefix='/compliance',tags=['compliance'])
@router.get('/search',response_model=ComplianceSearchResult)
def compliance_search(assessment_id: UUID, q: str = Query(min_length=1, max_length=500),
                      principal: Principal = Depends(require_principal), repository: PilotRepository = Depends(_repository)):
 return repository.compliance_search(assessment_id, q, principal.org_id)
