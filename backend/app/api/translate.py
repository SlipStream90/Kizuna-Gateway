"""Bearer-protected Japanese<->English translation endpoint.

Uses an optional NLLB-200 model (lazy-loaded) when ``transformers`` and model
weights are available; otherwise returns a deterministic illustrative
placeholder so the endpoint works offline. Every response states the provider
and whether a fallback was used, so translations are never mistaken for
verified content. Requires a valid OIDC bearer token.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_principal
from app.schemas.pilot import Principal
from app.schemas.translate import TranslateRequest, TranslateResponse, _validate_lang_pair

router = APIRouter(prefix="/translate", tags=["translate"])

_MODEL_NAME = "facebook/nllb-200-distilled-600M"
_NLLB_CODES = {"ja": "jpn_Jpan", "en": "eng_Latn"}
_model = None
_tokenizer = None


def _load_nllb():
    global _model, _tokenizer
    if _model is not None:
        return _model, _tokenizer
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore

        _tokenizer = AutoTokenizer.from_pretrained(_MODEL_NAME)
        _model = AutoModelForSeq2SeqLM.from_pretrained(_MODEL_NAME)
    except Exception:
        _model, _tokenizer = None, None
    return _model, _tokenizer


def _nllb_translate(text: str, source_lang: str, target_lang: str) -> str | None:
    model, tokenizer = _load_nllb()
    if model is None or tokenizer is None:
        return None
    try:
        import torch  # type: ignore

        tokenizer.src_lang = _NLLB_CODES[source_lang]
        encoded = tokenizer(text, return_tensors="pt")
        generated = model.generate(
            **encoded,
            forced_bos_token_id=tokenizer.lang_code_to_id[_NLLB_CODES[target_lang]],
            max_new_tokens=256,
        )
        return tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
    except Exception:
        return None


def _deterministic_placeholder(text: str, source_lang: str, target_lang: str) -> str:
    # Illustrative, deterministic, clearly-not-verified fallback so the
    # endpoint remains usable without any model or network dependency.
    marker = f"[{source_lang.upper()}->{target_lang.upper()}::illustrative]"
    return f"{marker} {text}"


@router.post("", response_model=TranslateResponse, status_code=status.HTTP_200_OK)
def translate(payload: TranslateRequest, principal: Principal = Depends(require_principal)):
    _validate_lang_pair(payload.source_lang, payload.target_lang)

    translated = _nllb_translate(payload.text, payload.source_lang, payload.target_lang)
    if translated is not None:
        return TranslateResponse(
            translated_text=translated,
            source_lang=payload.source_lang,
            target_lang=payload.target_lang,
            model=_MODEL_NAME,
            provider="nllb-200",
            deterministic_fallback=False,
        )

    return TranslateResponse(
        translated_text=_deterministic_placeholder(
            payload.text, payload.source_lang, payload.target_lang
        ),
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
        model="illustrative-fallback",
        provider="deterministic-fallback",
        deterministic_fallback=True,
    )
