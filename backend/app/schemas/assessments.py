from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class DecimalModel(BaseModel):
    model_config = ConfigDict(json_encoders={Decimal: lambda v: format(v, 'f')})
class AssessmentCreate(DecimalModel):
    product: str = Field(min_length=1, max_length=200); sector: str = Field(min_length=1); target_customer: str = Field(min_length=1)
    budget: Decimal = Field(ge=0); horizon_months: int = Field(ge=1, le=120); preferred_modes: list[str] = Field(min_length=1)
    hs_code: str | None = None; unit_value: Decimal | None = Field(default=None, ge=0); volume: int | None = Field(default=None, ge=1)
    weights: dict[str, Decimal] = Field(default_factory=lambda: {"market":Decimal("0.4"),"operations":Decimal("0.3"),"readiness":Decimal("0.3")})
    @field_validator('budget','unit_value', mode='before')
    @classmethod
    def no_float(cls, value):
        if value is not None and not isinstance(value, (str, Decimal)): raise ValueError('decimal values must be strings')
        return value
    @field_validator('weights', mode='before')
    @classmethod
    def weight_strings_only(cls, value):
        if value is not None and (not isinstance(value, dict) or any(not isinstance(item, (str, Decimal)) for item in value.values())): raise ValueError('weight values must be decimal strings')
        return value
    @model_validator(mode='after')
    def valid_weights(self):
        if not self.weights or any(v < 0 for v in self.weights.values()) or sum(self.weights.values()) != Decimal('1'):
            raise ValueError('weights must be non-negative and total exactly 1')
        return self
class AssessmentUpdate(DecimalModel):
    weights: dict[str, Decimal] | None = None; budget: Decimal | None = Field(default=None, ge=0); horizon_months: int | None = Field(default=None, ge=1, le=120)
    @field_validator('budget', mode='before')
    @classmethod
    def budget_string_only(cls, value):
        if value is not None and not isinstance(value, (str, Decimal)): raise ValueError('decimal values must be strings')
        return value
    @field_validator('weights', mode='before')
    @classmethod
    def weight_strings_only(cls, value):
        if value is not None and (not isinstance(value, dict) or any(not isinstance(item, (str, Decimal)) for item in value.values())): raise ValueError('weight values must be decimal strings')
        return value
    @model_validator(mode='after')
    def valid_weights(self):
        if self.weights is not None and (not self.weights or any(v < 0 for v in self.weights.values()) or sum(self.weights.values()) != Decimal('1')): raise ValueError('weights must be non-negative and total exactly 1')
        return self
class Assessment(AssessmentCreate):
    id: UUID; version: int; score_version: str; data_version: str; created_at: datetime; updated_at: datetime
