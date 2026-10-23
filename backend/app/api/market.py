from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth.dependencies import require_principal
from app.api.assessments import _repository
from app.domain.mcda import rank_regions
from app.seed.regions import REGIONS
from app.repositories.pilot_repository import PilotRepository
from app.schemas.pilot import Principal
from app.schemas.market import MarketRanking
router=APIRouter(prefix='/assessments',tags=['market'])
@router.get('/{assessment_id}/market-ranking',response_model=MarketRanking)
def market_ranking(assessment_id:UUID, principal: Principal = Depends(require_principal), repository: PilotRepository = Depends(_repository)):
 item=repository.get_assessment(assessment_id, principal.org_id)
 if not item: raise HTTPException(404,'Assessment not found')
 weights = item.payload.get('weights', {'market': '0.4', 'operations': '0.3', 'readiness': '0.3'})
 result = rank_regions({key: Decimal(value) for key, value in weights.items()}, REGIONS)
 result.assessment_id = str(assessment_id)
 return result
