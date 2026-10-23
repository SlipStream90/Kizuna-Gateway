"""Contracts for the tenant-isolated pilot trust foundation.

Monetary and rate values are deliberately represented as strings.  This keeps
JSON transport from turning exact Decimal values into binary floating points.
"""

from datetime import datetime, date
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class Role(str, Enum):
    MEMBER = "member"
    ADVISOR = "advisor"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class Principal(BaseModel):
    """Authenticated OIDC subject, constrained to one organization."""

    user_id: UUID
    org_id: UUID
    roles: frozenset[Role]


class AssessmentUpdate(BaseModel):
    """Mutable assessment fields; values are retained verbatim in revisions."""

    model_config = ConfigDict(extra="forbid")
    product: str | None = Field(default=None, min_length=1, max_length=500)
    sector: str | None = Field(default=None, min_length=1, max_length=200)
    buyer: str | None = Field(default=None, min_length=1, max_length=500)
    budget: str | None = Field(default=None, pattern=r"^-?\d+(?:\.\d+)?$")
    horizon_months: int | None = Field(default=None, ge=1, le=120)
    modes: list[Literal["direct", "distributor"]] | None = None
    hs_code: str | None = Field(default=None, pattern=r"^\d{4,10}$")
    value: str | None = Field(default=None, pattern=r"^-?\d+(?:\.\d+)?$")
    volume: str | None = Field(default=None, pattern=r"^-?\d+(?:\.\d+)?$")

    @field_validator("modes")
    @classmethod
    def unique_modes(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("modes must not contain duplicates")
        return value


class Assessment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    org_id: UUID
    created_by: UUID
    version: int = Field(ge=1)
    payload: dict[str, Any]
    updated_at: datetime


class Citation(BaseModel):
    """Immutable, approved corpus passage used to support an answer."""

    model_config = ConfigDict(extra="forbid")
    source_version_id: UUID
    passage_id: UUID
    authority: str
    url: HttpUrl
    locator: str
    text: str
    content_hash: str
    passage_hash: str
    retrieved_at: datetime
    effective_date: date | None = None
    reviewed_at: datetime


class AbstentionReason(str, Enum):
    NO_APPROVED_CORPUS = "no_approved_corpus"
    INSUFFICIENT_CLASSIFICATION = "insufficient_classification"
    OUT_OF_JURISDICTION = "out_of_jurisdiction"
    INSUFFICIENT_COVERAGE = "insufficient_coverage"
    EXPIRED_SOURCE = "expired_source"


class ComplianceSearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["answered", "abstained"]
    citations: list[Citation] = Field(default_factory=list)
    abstention_reasons: list[AbstentionReason] = Field(default_factory=list)

    @field_validator("abstention_reasons")
    @classmethod
    def abstention_is_unique(cls, value: list[AbstentionReason]) -> list[AbstentionReason]:
        return list(dict.fromkeys(value))


class SourceVersionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    authority: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    retrieved_at: datetime
    effective_date: date | None = None
    expires_at: date | None = None
    content_hash: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    status: Literal["draft", "approved", "rejected"] = "draft"


class SourceVersion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    source_id: UUID
    authority: str
    url: HttpUrl
    retrieved_at: datetime
    effective_date: date | None = None
    reviewed_at: datetime | None = None
    expires_at: date | None = None
    content_hash: str
    reviewed_by: UUID | None = None
    status: Literal["draft", "approved", "rejected"]


class ReportSnapshot(BaseModel):
    """Immutable replayable output. Decimal values within payload remain strings."""

    model_config = ConfigDict(extra="forbid")
    id: UUID
    org_id: UUID
    assessment_id: UUID
    assessment_revision: int
    formula_version: str
    data_version: str
    label_version: str
    source_passage_hashes: list[str]
    payload: dict[str, Any]
    created_at: datetime
