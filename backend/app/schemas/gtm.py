"""Decimal-safe contracts for the two-mode GTM comparison."""
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

class DecimalModel(BaseModel):
 model_config=ConfigDict(json_encoders={Decimal:lambda value:format(value,'f')})
 @field_serializer('*',when_used='json',check_fields=False)
 def serialize_decimal(self,value): return format(value,'f') if isinstance(value,Decimal) else value
class ModeAssumptions(DecimalModel):
 unit_value:Decimal=Field(ge=0);volume:int=Field(gt=0);shipping_cost:Decimal=Field(ge=0);insurance_rate:Decimal=Field(ge=0,le=1);channel_margin_rate:Decimal=Field(ge=0,le=1);local_setup_cost:Decimal=Field(ge=0);other_cost:Decimal=Field(ge=0)
 @field_validator('unit_value','shipping_cost','insurance_rate','channel_margin_rate','local_setup_cost','other_cost',mode='before')
 @classmethod
 def decimal_strings_only(cls,value):
  if not isinstance(value,str):raise ValueError('decimal values must be strings')
  return value
class GtmScenarioCreate(DecimalModel):
 direct:ModeAssumptions;distributor:ModeAssumptions;sensitivity_field:Literal['shipping_cost','insurance_rate','channel_margin_rate','local_setup_cost','other_cost'];sensitivity_delta:Decimal
 @field_validator('sensitivity_delta',mode='before')
 @classmethod
 def decimal_strings_only(cls,value):
  if not isinstance(value,str):raise ValueError('decimal values must be strings')
  return value
class GtmLineItem(DecimalModel):label:str;amount:Decimal
class ModeResult(DecimalModel):assumptions:ModeAssumptions;line_items:list[GtmLineItem];total:Decimal
class GtmScenarioResult(DecimalModel):
 id:str|None=None;generated_at:str;assumptions:dict[str,ModeAssumptions];direct:ModeResult;distributor:ModeResult;comparison:dict[str,Decimal];sensitivity_field:str;sensitivity:dict[str,Decimal];formula_version:str='gtm-v2';data_version:str='seed-2026-10'
