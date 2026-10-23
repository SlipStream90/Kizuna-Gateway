from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.auth.dependencies import require_role
from app.api.assessments import _repository
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Principal, Role, SourceVersion, SourceVersionCreate, SourceVersionReview
router=APIRouter(prefix='/sources',tags=['sources'])
@router.post('/{source_id}/versions', response_model=SourceVersion, status_code=status.HTTP_201_CREATED)
def create_source_version(source_id: UUID, payload: SourceVersionCreate,
                          principal: Principal = Depends(require_role(Role.REVIEWER, Role.ADMIN)),
                          repository: PilotRepository = Depends(_repository)):
 value = repository.create_source_version(source_id, payload, principal, request.headers.get('X-Request-ID', ''))
 if not value: raise HTTPException(status.HTTP_404_NOT_FOUND, 'Source record not found or version already exists')
 return value

@router.patch('/versions/{version_id}', response_model=SourceVersion)
def review_source_version(version_id: UUID, payload: SourceVersionReview, request: Request,
                          principal: Principal = Depends(require_role(Role.REVIEWER, Role.ADMIN)),
                          repository: PilotRepository = Depends(_repository)):
 value = repository.review_source_version(version_id, payload, principal, request.headers.get('X-Request-ID', ''))
 if not value: raise HTTPException(status.HTTP_404_NOT_FOUND, 'Draft source version not found')
 return value
