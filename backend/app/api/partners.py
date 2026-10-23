from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from app.auth.dependencies import require_principal
from app.schemas.pilot import Principal
from app.schemas.partners import PartnerList,PartnerScorecard
from app.services.partner_service import list_partners,scorecard
router=APIRouter(prefix='/partners',tags=['partners'])
@router.get('',response_model=PartnerList)
def partners(region_id:str|None=None,q:str|None=None,principal: Principal=Depends(require_principal)): return list_partners(region_id,q)
@router.get('/{partner_id}',response_model=PartnerScorecard)
def partner(partner_id:UUID, principal: Principal=Depends(require_principal)):
 p=scorecard(partner_id)
 if not p:raise HTTPException(404,'Partner not found')
 return p
