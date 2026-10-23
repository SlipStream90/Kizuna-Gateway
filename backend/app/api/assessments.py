from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from app.auth.dependencies import require_principal, require_role
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Assessment, AssessmentCreate, AssessmentUpdate, Principal, ReportSnapshot, Role
router=APIRouter(prefix='/assessments',tags=['assessments'])

def _repository(request: Request) -> PilotRepository:
    return PilotRepository(request.app.state.db_pool)

@router.post('', response_model=Assessment, status_code=status.HTTP_201_CREATED)
def create_assessment(payload: AssessmentCreate, request: Request,
                      principal: Principal = Depends(require_role(Role.MEMBER, Role.ADVISOR, Role.ADMIN)),
                      repository: PilotRepository = Depends(_repository)):
 return repository.create_assessment(payload, principal, request.headers.get('X-Request-ID', ''))

@router.get('/{assessment_id}', response_model=Assessment)
def get_assessment(assessment_id: UUID, principal: Principal = Depends(require_principal),
                   repository: PilotRepository = Depends(_repository)):
 item = repository.get_assessment(assessment_id, principal.org_id)
 if not item: raise HTTPException(status.HTTP_404_NOT_FOUND, 'Assessment not found')
 return item

@router.patch('/{assessment_id}',response_model=Assessment)
def patch_assessment(assessment_id: UUID, payload: AssessmentUpdate, request: Request,
                     if_match: int = Header(alias='If-Match', ge=1),
                     principal: Principal = Depends(require_role(Role.MEMBER, Role.ADVISOR, Role.ADMIN)),
                     repository: PilotRepository = Depends(_repository)):
 # Visibility is checked before applying the version predicate.  A caller must
 # never be able to distinguish an invisible ID from a stale visible revision.
 if not repository.get_assessment(assessment_id, principal.org_id):
  raise HTTPException(status.HTTP_404_NOT_FOUND, 'Assessment not found')
 item=repository.update_assessment(assessment_id,payload,if_match,principal,request.headers.get('X-Request-ID',''))
 if not item: raise HTTPException(status.HTTP_409_CONFLICT,'Assessment version is stale')
 return item

@router.post('/{assessment_id}/report',response_model=ReportSnapshot, status_code=status.HTTP_201_CREATED)
def snapshot_report(assessment_id: UUID, request: Request,
                    principal: Principal = Depends(require_role(Role.MEMBER, Role.ADVISOR, Role.ADMIN)),
                    repository: PilotRepository = Depends(_repository)):
 item = repository.create_report(assessment_id, principal, request.headers.get('X-Request-ID', ''))
 if not item: raise HTTPException(404, 'Assessment not found')
 return item

@router.get('/{assessment_id}/report',response_model=ReportSnapshot)
def report(assessment_id: UUID, revision: int = 1, principal: Principal = Depends(require_principal),
           repository: PilotRepository = Depends(_repository)):
 item = repository.report(assessment_id, revision, principal.org_id)
 if not item: raise HTTPException(404, 'Report revision not found')
 return item
