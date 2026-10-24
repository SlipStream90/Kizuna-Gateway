"""Contracts for the screened partner directory and its Japan-Readiness & Trust audit.

Percentages and scores are Decimals (serialised as strings by FastAPI's encoder for
exactness), matching the platform's no-binary-float convention for figures.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

RecordSource = Literal["simulated_fixture", "registry_mock", "registry_verified"]
Sector = Literal["auto", "electronics", "fmcg", "robotics", "chemicals"]
PartnerType = Literal["distributor", "supplier", "jv_partner", "contract_manufacturer"]
Pct = Decimal


class McaCompliance(BaseModel):
    status: Literal["active", "active_non_compliant", "dormant", "strike_off", "under_liquidation"]
    annual_filings_on_time_last3: int = Field(ge=0, le=3)
    last_annual_return_fy: str | None = None


class GstCompliance(BaseModel):
    status: Literal["active", "suspended", "cancelled"]
    returns_on_time_last12: int = Field(ge=0, le=12)
    last_return_period: str | None = None


class Director(BaseModel):
    name: str
    din: str
    role: str
    appointed_on: date
    ceased_on: date | None = None


class LitigationCase(BaseModel):
    forum: str
    case_type: Literal["tax", "corporate", "commercial", "labour"]
    status: Literal["pending", "disposed"]
    severity: Literal["major", "minor"]
    summary: str
    reference: str


class CreditRating(BaseModel):
    agency: str
    band: Literal["low", "moderate", "high", "unrated"]
    as_of: date | None = None


class IsoCertification(BaseModel):
    standard: Literal["ISO 9001", "ISO 14001"]
    status: Literal["verified", "claimed_unverified", "expired"]
    certificate_no: str | None = None
    certification_body: str | None = None
    valid_until: date | None = None


class Operations(BaseModel):
    otd_monthly_pct: list[Pct] = Field(min_length=1, max_length=12, description="Trailing months, oldest first.")
    fulfillment_accuracy_pct: Pct = Field(ge=0, le=100)
    client_retention_pct: Pct = Field(ge=0, le=100)
    foreign_principal_satisfaction_pct: Pct = Field(ge=0, le=100)
    sla_compliance_pct: Pct = Field(ge=0, le=100)

    @field_validator("otd_monthly_pct")
    @classmethod
    def _bounded(cls, values: list[Pct]) -> list[Pct]:
        if any(v < 0 or v > 100 for v in values):
            raise ValueError("OTD percentages must be within 0–100")
        return values


class CrossBorder(BaseModel):
    contracts_total: int = Field(ge=0)
    contracts_fulfilled: int = Field(ge=0)
    japanese_principals: int = Field(ge=0)


class PartnerRecord(BaseModel):
    """Everything the trust score is computed from; one row of partner_registry."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    partner_name: str
    record_source: RecordSource
    sector: Sector
    state: str
    city: str | None = None
    partner_type: PartnerType
    mca_registration_no: str
    gstin: str = Field(pattern=r"^[0-9]{2}[A-Z0-9]{13}$")
    registered_address: str
    incorporated_on: date | None = None
    mca_compliance: McaCompliance
    gst_compliance: GstCompliance
    director_history: list[Director] = []
    litigation: list[LitigationCase] = []
    financial_solvency_score: Pct | None = Field(default=None, ge=0, le=100)
    credit_rating: CreditRating
    iso_certifications: list[IsoCertification] = []
    operations: Operations
    cross_border: CrossBorder
    data_as_of: date

    @property
    def litigation_flag(self) -> bool:
        """A pending major tax or corporate matter."""
        return any(
            c.status == "pending" and c.severity == "major" and c.case_type in ("tax", "corporate")
            for c in self.litigation
        )


# ── Audit output ──────────────────────────────────────────────────────────────

Tier = Literal["japan_ready", "conditional", "high_friction", "not_recommended", "blocked"]


class ScoreComponent(BaseModel):
    key: str
    label: str
    points: Decimal
    max_points: Decimal
    reasons: list[str]


class TrustFlag(BaseModel):
    level: Literal["block", "warn", "info"]
    code: str
    message: str


class EvidenceLink(BaseModel):
    label: str
    url: str
    note: str


class TrustAudit(BaseModel):
    partner_id: UUID
    partner_name: str
    record_source: RecordSource
    simulated: bool
    score: Decimal = Field(description="Japan-Readiness & Trust Score, 0–100.")
    uncapped_score: Decimal
    tier: Tier
    components: list[ScoreComponent]
    flags: list[TrustFlag]
    otd_trailing_pct: Decimal
    evidence: list[EvidenceLink]
    scoring_version: str
    inputs_hash: str = Field(description="sha256 of the canonical inputs + scoring version; same hash → same score.")
    computed_at: datetime
    disclosure: str
    record: PartnerRecord = Field(description="The inputs this audit was computed from.")


class PartnerDirectoryItem(BaseModel):
    id: UUID
    partner_name: str
    record_source: RecordSource
    simulated: bool
    sector: Sector
    state: str
    city: str | None
    partner_type: PartnerType
    score: Decimal
    tier: Tier
    otd_trailing_pct: Decimal
    litigation_flag: bool
    credit_band: str
    iso_verified: list[str]
    block_flags: int
    warn_flags: int


class PartnerDirectory(BaseModel):
    partners: list[PartnerDirectoryItem]
    total: int
    filters: dict[str, str | None]
    scoring_version: str
    disclosure: str
