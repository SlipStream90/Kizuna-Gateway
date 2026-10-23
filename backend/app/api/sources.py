from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.auth.dependencies import require_role
from app.api.assessments import _repository
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Principal, Role, SourceVersion, SourceVersionCreate
router=APIRouter(prefix='/sources',tags=['sources'])
@router.post('/{source_id}/versions', response_model=SourceVersion, status_code=status.HTTP_201_CREATED)
def create_source_version(source_id: UUID, payload: SourceVersionCreate,
                          principal: Principal = Depends(require_role(Role.REVIEWER, Role.ADMIN)),
                          repository: PilotRepository = Depends(_repository)):
 value = repository.create_source_version(source_id, payload, principal.user_id)
 if not value: raise HTTPException(status.HTTP_409_CONFLICT, 'Source version content hash already exists')
 return value
