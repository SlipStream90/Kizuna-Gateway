from uuid import UUID
from fastapi import APIRouter,HTTPException
from app.schemas.market import MarketRanking
from app.services import assessment_service,market_service
router=APIRouter(prefix='/assessments',tags=['market'])
@router.get('/{assessment_id}/market-ranking',response_model=MarketRanking)
def market_ranking(assessment_id:UUID):
 item=assessment_service.get(assessment_id)
 if not item: raise HTTPException(404,'Assessment not found')
 return market_service.ranking(item)
