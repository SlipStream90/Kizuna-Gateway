"""Contracts for clause-level statutory semantic search (POST /api/v1/compliance/search)."""

import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StatuteSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=1000, description="Natural-language question, English or Japanese.")
    k: int = Field(default=5, ge=1, le=20)
    document_codes: list[str] | None = Field(default=None, max_length=20, description="Restrict to these documents.")
    min_similarity: float | None = Field(default=None, ge=-1.0, le=1.0)
    lang: Literal["en", "ja"] = Field(default="en", description="Language for formatted citations.")

    @field_validator("query")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value

    @field_validator("document_codes")
    @classmethod
    def _codes(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and not all(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", c) for c in value):
            raise ValueError("invalid document code")
        return value


class StatuteHit(BaseModel):
    id: UUID
    document_code: str
    document_title: str
    authority: str
    clause_reference: str = Field(description="Exact locator as cited, e.g. 'Section 149(3)'.")
    citation_id: str = Field(description="Stable identifier, e.g. 'RBI-MD-FI/Paragraph 4.2'.")
    citation: str = Field(description="Formatted badge text, e.g. '[RBI Master Direction (FI), Paragraph 4.2]'.")
    similarity: float = Field(description="Cosine similarity, 1 - (embedding <=> query).")
    content: str
    hierarchy: dict[str, Any]
    page_start: int | None
    page_end: int | None
    source_url_or_file: str
    last_verified_date: datetime | None
    badge: dict[str, Any] = Field(description="Payload for the JIG-OS CitationBadge component.")


class StatuteSearchResponse(BaseModel):
    query: str
    embedding_model: str
    semantic: bool = Field(description="False when the lexical hashing embedder is active (tests/offline).")
    review_required: bool = True
    results: list[StatuteHit]
    citation_index: list[str] = Field(description="Numbered lines for the Ringi-sho Regulatory Citation Index.")


AnswerStatus = Literal["answered", "insufficient_evidence", "generation_unavailable", "refused"]


class StatuteAnswerRequest(StatuteSearchRequest):
    """Same retrieval controls as search; `k` clauses are given to the model as its only sources."""

    k: int = Field(default=6, ge=1, le=12)


class AnswerParagraph(BaseModel):
    text: str
    citations: list[str] = Field(description="citation_ids of retrieved clauses supporting this paragraph.")
    badges: list[dict[str, Any]]
    figures_verified: bool = Field(
        description="True when every number in the paragraph appears in its cited clauses (or the question)."
    )


class StatuteAnswerResponse(BaseModel):
    query: str
    lang: Literal["en", "ja"]
    status: AnswerStatus
    answer: list[AnswerParagraph]
    removed_paragraphs: int = Field(description="Generated paragraphs dropped for citing nothing that was retrieved.")
    notice: str | None = None
    generation_model: str | None = None
    embedding_model: str
    semantic: bool
    review_required: bool = True
    sources: list[StatuteHit] = Field(description="The retrieved clauses the answer was restricted to.")
    citation_index: list[str]
