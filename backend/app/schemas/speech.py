"""Request/response contracts for the LFM2.5-Audio-JP speech-to-speech adapter.

Audio is accepted as a base64-encoded WAV/PCM blob (client captures via the
MediaRecorder API and forwards through the BFF proxy). The backend delegates
speech-to-speech translation to a local llama.cpp server running the
LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF model (OpenAI-compatible chat endpoint).
When the local endpoint is unavailable, a deterministic illustrative fallback
is returned so the endpoint stays functional offline.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SpeechTranslateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audio_base64: str = Field(min_length=1)
    source_lang: str = Field(default="ja", pattern=r"^[a-z]{2}$")
    target_lang: str = Field(default="en", pattern=r"^[a-z]{2}$")


class SpeechTranslateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transcript: str
    translated_text: str
    source_lang: str
    target_lang: str
    provider: str
    endpoint: str | None
    deterministic_fallback: bool
