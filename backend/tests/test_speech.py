"""Bearer-protected speech-to-speech translation via Liquid AI liquid-audio.

Tests the bearer gate and the offline deterministic fallback (no liquid-audio
dependencies installed). The happy path is exercised by monkeypatching the
liquid-audio imports.
"""

import base64
import io
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


def test_speech_falls_back_when_liquid_audio_unavailable(monkeypatch):
    principal = require_principal(_bearer(_mint_token()))
    # Make torch import fail inside the function
    monkeypatch.setattr(speech_service, "sf", None, raising=False)
    response = speech_service.speech_translate(
        SpeechTranslateRequest(audio_base64="UklGRiQAAABXQVZFZm10IwAAAABAAEAQB8AAEA")
    )
    assert response.deterministic_fallback is True
    assert response.provider == "deterministic-fallback"
    assert response.output_audio_base64 is None
    assert response.translated_text != ""


def test_speech_translate_with_mocked_liquid_audio(monkeypatch):
    pytest.importorskip("torch", reason="torch not available for Python 3.15 yet")
    principal = require_principal(_bearer(_mint_token()))

    # Mock sf.read to return a valid audio array
    monkeypatch.setattr(
        speech_service.sf,
        "read",
        lambda bio, dtype=None: ([0.0] * 16000, 16000),
    )
    # Mock sf.write to do nothing (we just need it to not raise)
    monkeypatch.setattr(speech_service.sf, "write", lambda buf, array, sr, format=None: None)

    import torch

    class FakeToken:
        def __init__(self, numel_val):
            self._numel = numel_val
        def numel(self):
            return self._numel

    class FakeProcessor:
        class text:
            @staticmethod
            def decode(token):
                return "Hello, how are you?"
        class audio:
            @staticmethod
            def decode(tokens):
                return np.zeros((16000,), dtype=np.float32)

    class FakeModel:
        def generate_interleaved(self, **kwargs):
            yield FakeToken(1)
            yield FakeToken(1)
            yield torch.tensor([1.0, 2.0, 3.0])

    class FakeChatState(dict):
        def __init__(self, processor):
            super().__init__()
            self.processor = processor
        def new_turn(self, role):
            pass
        def add_text(self, text):
            pass
        def add_audio(self, audio, sample_rate):
            pass
        def end_turn(self):
            pass

    monkeypatch.setattr(
        "liquid_audio.LFM2AudioProcessor.from_pretrained",
        staticmethod(lambda model_id: FakeProcessor()),
    )
    monkeypatch.setattr(
        "liquid_audio.LFM2AudioModel.from_pretrained",
        staticmethod(lambda model_id: FakeModel()),
    )
    monkeypatch.setattr("liquid_audio.ChatState", FakeChatState)

    response = speech_service.speech_translate(
        SpeechTranslateRequest(audio_base64=base64.b64encode(b"fake-audio-bytes").decode("ascii"))
    )
    assert response.deterministic_fallback is False
    assert response.provider == "lfm2-5-audio-jp"
    assert response.output_audio_base64 is not None
    assert response.translated_text == "Hello, how are you?"
