from fastapi import APIRouter,HTTPException
from app.schemas.sources import SourceRecord
from app.services.compliance_service import source
router=APIRouter(prefix='/sources',tags=['sources'])
@router.get('/{source_id}',response_model=SourceRecord)
def get_source(source_id:str):
 value=source(source_id)
 if not value:raise HTTPException(404,'Source not found')
 return value
