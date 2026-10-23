from uuid import UUID
from fastapi import APIRouter,HTTPException,status
from app.schemas.gtm import GtmScenarioCreate,GtmScenarioResult
from app.services import assessment_service
from app.services.gtm_service import create
router=APIRouter(prefix='/assessments',tags=['gtm'])
@router.post('/{assessment_id}/gtm-scenarios',response_model=GtmScenarioResult,status_code=status.HTTP_201_CREATED)
def create_gtm(assessment_id:UUID,payload:GtmScenarioCreate):
 if not assessment_service.get(assessment_id):raise HTTPException(404,'Assessment not found')
 return create(assessment_id,payload)
