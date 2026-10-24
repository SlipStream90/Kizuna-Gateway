from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException,Query,Request
from app.auth.dependencies import require_principal
from app.api.assessments import _repository
from app.schemas.pilot import Principal
from app.schemas.partners import PartnerList,PartnerScorecard
from app.schemas.partner_registry import PartnerDirectory, Sector, TrustAudit
from app.repositories.pilot_repository import PilotRepository
from app.repositories.partner_registry_repository import PartnerRegistryRepository
from app.services import partner_trust_service
router=APIRouter(prefix='/partners',tags=['partners'])


def _registry(request: Request) -> PartnerRegistryRepository:
    return PartnerRegistryRepository(request.app.state.db_pool)


@router.get('',response_model=PartnerList | PartnerDirectory)
def partners(assessment_id: UUID | None = None, region_id: str | None = None, q: str | None = None,
             sector: Sector | None = None, state: str | None = Query(default=None, max_length=60),
             min_otd: Decimal | None = Query(default=None, ge=0, le=100),
             min_trust_score: Decimal | None = Query(default=None, ge=0, le=100),
             principal: Principal = Depends(require_principal),
             repository: PilotRepository = Depends(_repository),
             registry: PartnerRegistryRepository = Depends(_registry)):
    """With `assessment_id`: the partners shortlisted for that assessment (tenant-scoped, unchanged).
    Without it: the screened partner directory with Japan-Readiness & Trust Scores, filterable by
    sector, state, minimum trailing-12-month OTD and minimum trust score."""
    if assessment_id is not None:
        value = repository.list_partners(assessment_id, principal.org_id, region_id, q)
        if value is None: raise HTTPException(404,'Assessment not found')
        return value
    return partner_trust_service.directory(registry, sector, state, min_otd, min_trust_score)


@router.post('/{partner_id}/audit-score', response_model=TrustAudit)
def audit_score(partner_id: UUID, registry: PartnerRegistryRepository = Depends(_registry)):
    """Deterministic due-diligence breakdown: compliance gates, ISO, credit, OTD and cross-border record."""
    result = partner_trust_service.audit_partner(registry, partner_id)
    if result is None: raise HTTPException(404,'Partner not found')
    return result


@router.get('/{partner_id}',response_model=PartnerScorecard)
def partner(partner_id:UUID, assessment_id: UUID, principal: Principal=Depends(require_principal), repository: PilotRepository=Depends(_repository)):
 p=repository.partner(assessment_id, partner_id, principal.org_id)
 if not p:raise HTTPException(404,'Partner not found')
 return p
