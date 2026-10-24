"""Speech-to-speech translation using Liquid AI's liquid-audio pipeline.

Loads LiquidAI/LFM2.5-Audio-1.5B-JP natively (no GGUF, no llama.cpp) and uses
the official interleaved generation pattern: Japanese audio in, interleaved
English text + English audio out. Falls back to a deterministic illustrative
response when the model or dependencies are unavailable so the route stays
functional offline.
"""

from __future__ import annotations

import base64
import io
import os
from functools import lru_cache

import soundfile as sf

from app.schemas.speech import SpeechTranslateRequest, SpeechTranslateResponse

_DEFAULT_MODEL = "LiquidAI/LFM2.5-Audio-1.5B-JP"


@lru_cache(maxsize=1)
def _model_id() -> str:
    return os.getenv("LFM_MODEL_ID", _DEFAULT_MODEL)


def _fallback(text_hint: str) -> SpeechTranslateResponse:
    return SpeechTranslateResponse(
        transcript=text_hint or "(audio capture — model unavailable)",
        translated_text=f"[ja->en::illustrative] {text_hint or '(audio capture)'}",
        source_lang="ja",
        target_lang="en",
        provider="deterministic-fallback",
        output_audio_base64=None,
        deterministic_fallback=True,
    )


def speech_translate(request: SpeechTranslateRequest) -> SpeechTranslateResponse:
    """Translate spoken Japanese to spoken English via liquid-audio interleaved generation."""
    try:
        import torch  # type: ignore
        from liquid_audio import (  # type: ignore
            ChatState,
            LFM2AudioModel,
            LFM2AudioProcessor,
            LFMModality,
        )
    except Exception:
        return _fallback(request.audio_base64[:60])

    try:
        audio_bytes = base64.b64decode(request.audio_base64)
        audio_array, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        if audio_array.ndim == 2:
            audio_array = audio_array.mean(axis=1)
        audio_tensor = torch.from_numpy(audio_array).unsqueeze(0)
    except Exception:
        return _fallback(request.audio_base64[:60])

    try:
        processor = LFM2AudioProcessor.from_pretrained(_model_id()).eval()
        model = LFM2AudioModel.from_pretrained(_model_id()).eval()
    except Exception:
        return _fallback(request.audio_base64[:60])

    chat = ChatState(processor)
    chat.new_turn("system")
    chat.add_text(
        "You are a Japanese-to-English speech translator. "
        "Transcribe the user's Japanese audio and translate it into natural English. "
        "Reply with the transcription and the translation only, then speak the English translation."
    )
    chat.end_turn()

    chat.new_turn("user")
    chat.add_audio(audio_tensor, sample_rate)
    chat.end_turn()

    chat.new_turn("assistant")

    text_parts: list[str] = []
    audio_tokens: list = []

    try:
        with torch.inference_mode():
            for token in model.generate_interleaved(
                **chat,
                max_new_tokens=512,
                audio_temperature=1.0,
                audio_top_k=4,
            ):
                if token.numel() == 1:
                    text_parts.append(processor.text.decode(token))
                else:
                    audio_tokens.append(token)
    except Exception:
        return _fallback(request.audio_base64[:60])

    transcript = "".join(text_parts).strip()
    translated_text = transcript or "(no text generated)"

    output_audio_base64: str | None = None
    if audio_tokens:
        try:
            audio_tensor_cat = torch.cat(audio_tokens, dim=0)
            audio_array_out = processor.audio.decode(audio_tensor_cat)
            buf = io.BytesIO()
            sf.write(buf, audio_array_out, sample_rate, format="WAV")
            output_audio_base64 = base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception:
            output_audio_base64 = None

    return SpeechTranslateResponse(
        transcript=transcript,
        translated_text=translated_text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        provider="lfm2-5-audio-jp",
        output_audio_base64=output_audio_base64,
        deterministic_fallback=False,
    )
