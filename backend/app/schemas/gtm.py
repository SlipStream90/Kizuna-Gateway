from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
class GtmScenarioCreate(BaseModel):
 mode:str = Field(pattern='^(direct_export|distributor_led)$'); unit_value:Decimal; volume:int=Field(gt=0); logistics_per_unit:Decimal=Field(ge=0); channel_margin_rate:Decimal=Field(ge=0,le=1); sensitivity_rate:Decimal=Field(default=Decimal('0.10'),ge=0,le=1)
 @field_validator('unit_value','logistics_per_unit','channel_margin_rate','sensitivity_rate',mode='before')
 @classmethod
 def strings_only(cls,v):
  if isinstance(v,float):raise ValueError('decimal values must be strings')
  return v
class GtmLineItem(BaseModel): label:str; amount:Decimal
class GtmScenarioResult(BaseModel): mode:str; assumptions:dict[str,str]; line_items:list[GtmLineItem]; total:Decimal; sensitivity:dict[str,Decimal]; calculation_version:str='gtm-v1'
