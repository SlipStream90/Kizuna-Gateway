from decimal import Decimal
from pydantic import BaseModel, ConfigDict
class Region(BaseModel):
    id: str; name: str; component_scores: dict[str, Decimal]; coverage: Decimal; source_ids: list[str]; warnings: list[str]
class RankedRegion(BaseModel):
    rank: int; region_id: str; name: str; score: Decimal; components: dict[str, Decimal]; coverage: Decimal; source_ids: list[str]; warnings: list[str]
class MarketRanking(BaseModel):
    assessment_id: str | None = None; score_version: str = 'mcda-v1'; data_version: str = 'seed-2026-10'; rows: list[RankedRegion]
