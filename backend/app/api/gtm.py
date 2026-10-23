from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException,status
from app.auth.dependencies import require_role
from app.api.assessments import _repository
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Principal,Role
from app.domain.gtm import calculate_gtm
from app.schemas.gtm import GtmScenarioCreate,GtmScenarioResult
router=APIRouter(prefix='/assessments',tags=['gtm'])
@router.post('/{assessment_id}/gtm-scenarios',response_model=GtmScenarioResult,status_code=status.HTTP_201_CREATED)
def create_gtm(assessment_id:UUID,payload:GtmScenarioCreate,principal: Principal=Depends(require_role(Role.MEMBER,Role.ADVISOR,Role.ADMIN)),repository: PilotRepository=Depends(_repository)):
 if not repository.get_assessment(assessment_id,principal.org_id):raise HTTPException(404,'Assessment not found')
 return calculate_gtm(payload)
