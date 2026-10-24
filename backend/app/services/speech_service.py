"""Speech-to-speech translation backed by a local llama.cpp server running
LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF (OpenAI-compatible chat endpoint).

When the local endpoint is unreachable, a deterministic illustrative fallback
is returned so the route stays functional offline. All network access is
opt-in via LLAMA_BASE_URL; nothing reaches the public internet by default.
"""

from __future__ import annotations

import os
from functools import lru_cache

import httpx

from app.schemas.speech import SpeechTranslateRequest, SpeechTranslateResponse

_DEFAULT_BASE_URL = "http://localhost:8080"
_DEFAULT_MODEL = "LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF"
_REQUEST_TIMEOUT_SECONDS = 60


@lru_cache(maxsize=1)
def _base_url() -> str:
    return os.getenv("LLAMA_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")


@lru_cache(maxsize=1)
def _model() -> str:
    return os.getenv("LLAMA_MODEL", _DEFAULT_MODEL)


def _fallback(text_hint: str) -> SpeechTranslateResponse:
    return SpeechTranslateResponse(
        transcript=text_hint or "(audio capture — endpoint unavailable)",
        translated_text=f"[ja->en::illustrative] {text_hint or '(audio capture)'}",
        source_lang="ja",
        target_lang="en",
        provider="deterministic-fallback",
        endpoint=None,
        deterministic_fallback=True,
    )


def speech_translate(request: SpeechTranslateRequest) -> SpeechTranslateResponse:
    """Translate spoken Japanese to spoken English via the local llama.cpp server."""
    base = _base_url()
    if not base:
        return _fallback(request.audio_base64[:60])

    try:
        with httpx.Client(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
            response = client.post(
                f"{base}/v1/chat/completions",
                json={
                    "model": _model(),
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a Japanese-to-English speech translator. "
                                "Transcribe the user's Japanese audio and translate it "
                                "into natural English. Reply with the transcription and "
                                "the translation only."
                            ),
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "[audio]"},
                                {"type": "input_audio", "input_audio": {"data": request.audio_base64}},
                            ],
                        },
                    ],
                },
            )
        if response.status_code != 200:
            return _fallback(request.audio_base64[:60])
        body = response.json()
        choices = body.get("choices") or []
        content = ""
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content") or ""
        if not content:
            return _fallback(request.audio_base64[:60])
        return SpeechTranslateResponse(
            transcript=content,
            translated_text=content,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            provider="lfm2-5-audio-jp",
            endpoint=base,
            deterministic_fallback=False,
        )
    except (httpx.HTTPError, httpx.ConnectError, OSError, ValueError):
        return _fallback(request.audio_base64[:60])
