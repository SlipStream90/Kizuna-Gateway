"""Bearer-protected Japanese<->English translation endpoint.

Exercises the offline deterministic fallback path (no transformers/torch
installed) and the bearer verification gate.
"""

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies import require_principal
from app.auth.keys import clear_caches
from app.auth.settings import settings

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


def test_translate_uses_deterministic_fallback_without_ml_dependencies():
    principal = require_principal(_bearer(_mint_token()))
    assert str(principal.org_id) == ORG
    from app.api.translate import translate

    result = translate(
        __import__("app.schemas.translate", fromlist=["TranslateRequest"]).TranslateRequest(
            text="Konnichiwa", source_lang="ja", target_lang="en"
        ),
        principal,
    )
    assert result.deterministic_fallback is True
    assert result.provider == "deterministic-fallback"
    assert result.translated_text != ""
    assert result.source_lang == "ja" and result.target_lang == "en"


def test_translate_rejects_same_lang_and_unsupported_lang(monkeypatch):
    principal = require_principal(_bearer(_mint_token()))
    from app.api.translate import translate
    from app.schemas.translate import TranslateRequest

    with pytest.raises(ValueError):
        translate(TranslateRequest(text="x", source_lang="ja", target_lang="ja"), principal)
    with pytest.raises(ValueError):
        translate(TranslateRequest(text="x", source_lang="fr", target_lang="en"), principal)


def test_translate_requires_bearer_scheme():
    with pytest.raises(HTTPException) as error:
        require_principal(None)
    assert error.value.status_code == 401


def test_translate_rejects_invalid_bearer_token():
    with pytest.raises(HTTPException) as error:
        require_principal(_bearer("not-a-jwt"))
    assert error.value.status_code == 401
