"""Local development session issuance: gating, claims and verifier agreement."""

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api import dev
from app.auth.dependencies import require_principal
from app.auth.keys import clear_caches
from app.auth.settings import settings
from app.schemas.pilot import Role

KEY = "01234567890123456789012345678901"
ORG = "11111111-1111-1111-1111-111111111111"


@pytest.fixture(autouse=True)
def oidc_env(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_SIGNING_KEY", KEY)
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "HS256")
    monkeypatch.setenv("DEV_ORG_ID", ORG)
    settings.cache_clear()
    clear_caches()
    yield
    settings.cache_clear()
    clear_caches()


def test_disabled_endpoint_is_invisible(monkeypatch):
    monkeypatch.delenv("DEV_AUTH_ENABLED", raising=False)
    with pytest.raises(HTTPException) as error:
        dev.create_dev_session()
    assert error.value.status_code == 404


def test_enabled_session_is_accepted_by_the_bearer_verifier(monkeypatch):
    monkeypatch.setenv("DEV_AUTH_ENABLED", "1")
    session = dev.create_dev_session()
    principal = require_principal(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=session.access_token)
    )
    assert principal.org_id == session.org_id
    assert principal.user_id == session.user_id
    assert Role.ADMIN in principal.roles


def test_token_claims_match_the_configured_issuer_and_audience(monkeypatch):
    monkeypatch.setenv("DEV_AUTH_ENABLED", "true")
    session = dev.create_dev_session()
    claims = jwt.decode(
        session.access_token,
        KEY,
        algorithms=["HS256"],
        issuer="https://issuer.example.test",
        audience="kizuna-pilot",
        options={"require": ["exp", "iat", "iss", "aud", "sub", "org_id"]},
    )
    assert claims["org_id"] == ORG
    assert claims["roles"] == ["admin"]


def test_asymmetric_configuration_refuses_to_mint(monkeypatch):
    monkeypatch.setenv("DEV_AUTH_ENABLED", "1")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    settings.cache_clear()
    with pytest.raises(HTTPException) as error:
        dev.create_dev_session()
    assert error.value.status_code == 503


def test_short_signing_key_refuses_to_mint(monkeypatch):
    monkeypatch.setenv("DEV_AUTH_ENABLED", "1")
    monkeypatch.setenv("OIDC_SIGNING_KEY", "too-short")
    settings.cache_clear()
    with pytest.raises(HTTPException) as error:
        dev.create_dev_session()
    assert error.value.status_code == 503


def test_token_lifetime_is_clamped(monkeypatch):
    monkeypatch.setenv("DEV_AUTH_ENABLED", "1")
    monkeypatch.setenv("DEV_TOKEN_TTL_SECONDS", "999999")
    assert dev.create_dev_session().expires_in == dev.MAX_TOKEN_TTL_SECONDS
    monkeypatch.setenv("DEV_TOKEN_TTL_SECONDS", "nonsense")
    assert dev.create_dev_session().expires_in == 3600
