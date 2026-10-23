from uuid import UUID
from fastapi import APIRouter,Query
from app.schemas.compliance import ComplianceSearchResult
from app.services.compliance_service import search
router=APIRouter(prefix='/compliance',tags=['compliance'])
@router.get('/search',response_model=ComplianceSearchResult)
def compliance_search(assessment_id:UUID,q:str=Query(min_length=1)): return search(q)
