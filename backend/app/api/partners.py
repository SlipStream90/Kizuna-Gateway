from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from app.auth.dependencies import require_principal
from app.api.assessments import _repository
from app.schemas.pilot import Principal
from app.schemas.partners import PartnerList,PartnerScorecard
from app.repositories.pilot_repository import PilotRepository
router=APIRouter(prefix='/partners',tags=['partners'])
@router.get('',response_model=PartnerList)
def partners(assessment_id: UUID, region_id:str|None=None,q:str|None=None,
             principal: Principal=Depends(require_principal), repository: PilotRepository=Depends(_repository)):
 value = repository.list_partners(assessment_id, principal.org_id, region_id, q)
 if value is None: raise HTTPException(404,'Assessment not found')
 return value
@router.get('/{partner_id}',response_model=PartnerScorecard)
def partner(partner_id:UUID, assessment_id: UUID, principal: Principal=Depends(require_principal), repository: PilotRepository=Depends(_repository)):
 p=repository.partner(assessment_id, partner_id, principal.org_id)
 if not p:raise HTTPException(404,'Partner not found')
 return p
