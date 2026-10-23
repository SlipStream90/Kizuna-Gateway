from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from app.schemas.assessments import AssessmentCreate,AssessmentUpdate,Assessment
from app.services import assessment_service
router=APIRouter(prefix='/assessments',tags=['assessments'])
@router.post('',response_model=Assessment,status_code=status.HTTP_201_CREATED)
def create_assessment(payload:AssessmentCreate): return assessment_service.create(payload)
@router.get('/{assessment_id}',response_model=Assessment)
def get_assessment(assessment_id:UUID):
 item=assessment_service.get(assessment_id)
 if not item: raise HTTPException(404,'Assessment not found')
 return item
@router.patch('/{assessment_id}',response_model=Assessment)
def patch_assessment(assessment_id:UUID,payload:AssessmentUpdate):
 item=assessment_service.update(assessment_id,payload)
 if not item: raise HTTPException(404,'Assessment not found')
 return item
