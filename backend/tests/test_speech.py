"""Bearer-protected speech-to-speech translation via local llama.cpp endpoint.

Tests the bearer gate and the offline deterministic fallback (no llama.cpp
server running). The happy path is exercised by monkeypatching httpx.
"""

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies import require_principal
from app.auth.keys import clear_caches
from app.auth.settings import settings
from app.schemas.speech import SpeechTranslateRequest
from app.services import speech_service

KEY = "01234567890123456789012345678901"
ISSUER = "https://issuer.example.test"
AUDIENCE = "kizuna-pilot"
ORG = "11111111-1111-1111-1111-111111111111"
DB = "postgresql://kizuna_app:app-password@localhost:5432/kizuna_test"


@pytest.fixture(autouse=True)
def oidc_env(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", ISSUER)
    monkeypatch.setenv("OIDC_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("OIDC_SIGNING_KEY", KEY)
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "HS256")
    monkeypatch.setenv("DEV_ORG_ID", ORG)
    monkeypatch.setenv("DATABASE_URL", DB)
    monkeypatch.delenv("LLAMA_BASE_URL", raising=False)
    settings.cache_clear()
    clear_caches()
    yield
    settings.cache_clear()
    clear_caches()


def _mint_token() -> str:
    import time
    return jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": "00000000-0000-0000-0000-000000000001",
            "org_id": ORG,
            "roles": ["member"],
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        },
        KEY,
        algorithm="HS256",
    )


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_speech_requires_bearer():
    with pytest.raises(HTTPException) as error:
        require_principal(None)
    assert error.value.status_code == 401


def test_speech_rejects_invalid_bearer():
    with pytest.raises(HTTPException) as error:
        require_principal(_bearer("not-a-jwt"))
    assert error.value.status_code == 401


def test_speech_falls_back_when_no_local_endpoint(monkeypatch):
    principal = require_principal(_bearer(_mint_token()))
    response = speech_service.speech_translate(
        SpeechTranslateRequest(audio_base64="UklGRiQAAABXQVZFZm10IwAAAABAAEAQB8AAEA")
    )
    assert response.deterministic_fallback is True
    assert response.provider == "deterministic-fallback"
    assert response.endpoint is None
    assert response.translated_text != ""


def test_speech_uses_llama_endpoint_when_available(monkeypatch):
    monkeypatch.setenv("LLAMA_BASE_URL", "http://localhost:8080")
    speech_service._base_url.cache_clear()
    speech_service._model.cache_clear()

    class FakeResponse:
        status_code = 200
        def json(self):
            return {"choices": [{"message": {"content": "Hello, how are you?"}}]}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
        def post(self, url, json=None, timeout=None):
            return FakeResponse()

    monkeypatch.setattr(speech_service.httpx, "Client", FakeClient)
    response = speech_service.speech_translate(
        SpeechTranslateRequest(audio_base64="UklGRiQAAABXQVZFZm10IwAAAABAAEAQB8AAEA")
    )
    assert response.deterministic_fallback is False
    assert response.provider == "lfm2-5-audio-jp"
    assert response.endpoint == "http://localhost:8080"
    assert response.translated_text == "Hello, how are you?"
