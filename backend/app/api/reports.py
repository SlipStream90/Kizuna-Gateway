from uuid import UUID
from fastapi import APIRouter,HTTPException
from app.schemas.reports import ReportSnapshot
from app.services import assessment_service
from app.services.report_service import build
router=APIRouter(prefix='/assessments',tags=['reports'])
@router.get('/{assessment_id}/report',response_model=ReportSnapshot)
def report(assessment_id:UUID):
 a=assessment_service.get(assessment_id)
 if not a:raise HTTPException(404,'Assessment not found')
 return build(a)
