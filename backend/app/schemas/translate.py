"""Request/response contracts for the Japanese<->English translation adapter.

The adapter is provider-neutral: it uses an optional NLLB-200 model when the
``transformers`` runtime and model weights are available, and otherwise falls
back to a deterministic illustrative placeholder so the endpoint stays
functional offline (matching the platform's no-hidden-network-dependency
constraint). Translations are never presented as verified business content.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_SUPPORTED = frozenset({"ja", "en"})


class TranslateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=4000)
    source_lang: str = Field(default="ja", pattern=r"^[a-z]{2}$")
    target_lang: str = Field(default="en", pattern=r"^[a-z]{2}$")


class TranslateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    translated_text: str
    source_lang: str
    target_lang: str
    model: str
    provider: str
    deterministic_fallback: bool


def _validate_lang_pair(source_lang: str, target_lang: str) -> None:
    if source_lang not in _SUPPORTED or target_lang not in _SUPPORTED:
        raise ValueError("only ja<->en is supported")
    if source_lang == target_lang:
        raise ValueError("source and target language must differ")
