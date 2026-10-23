from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from app.auth.dependencies import require_principal, require_role
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Assessment, AssessmentUpdate, Principal, ReportSnapshot, Role
router=APIRouter(prefix='/assessments',tags=['assessments'])

def _repository(request: Request) -> PilotRepository:
    return PilotRepository(request.app.state.db_pool)

@router.patch('/{assessment_id}',response_model=Assessment)
def patch_assessment(assessment_id: UUID, payload: AssessmentUpdate, request: Request,
                     if_match: int = Header(alias='If-Match', ge=1),
                     principal: Principal = Depends(require_role(Role.MEMBER, Role.ADVISOR, Role.ADMIN)),
                     repository: PilotRepository = Depends(_repository)):
 item=repository.update_assessment(assessment_id,payload,if_match,principal,request.headers.get('X-Request-ID',''))
 if not item: raise HTTPException(status.HTTP_409_CONFLICT,'Assessment is absent or its version is stale')
 return item

@router.get('/{assessment_id}/report',response_model=ReportSnapshot)
def report(assessment_id: UUID, revision: int, principal: Principal = Depends(require_principal),
           repository: PilotRepository = Depends(_repository)):
 item = repository.report(assessment_id, revision, principal.org_id)
 if not item: raise HTTPException(404, 'Report revision not found')
 return item
