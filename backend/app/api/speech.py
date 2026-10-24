"""Bearer-protected speech-to-speech translation via a local llama.cpp server
running LiquidAI/LFM2.5-Audio-1.5B-JP-GGUF. Falls back to a deterministic
illustrative response when the local endpoint is unavailable.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_principal
from app.schemas.pilot import Principal
from app.schemas.speech import SpeechTranslateRequest, SpeechTranslateResponse
from app.services.speech_service import speech_translate

router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/translate", response_model=SpeechTranslateResponse, status_code=status.HTTP_200_OK)
def speech_translate_endpoint(
    payload: SpeechTranslateRequest,
    principal: Principal = Depends(require_principal),
) -> SpeechTranslateResponse:
    return speech_translate(payload)
