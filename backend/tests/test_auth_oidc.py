"""Asymmetric verification, claim mapping and issuer-key resolution."""

import json
import time
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import keys
from app.auth.dependencies import _roles, require_principal, resolve_claim
from app.auth.settings import settings
from app.schemas.pilot import Role

ORG = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def rsa_keypair():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _claims(**overrides):
    claims = {
        "iss": "https://issuer.example.test/realms/kizuna",
        "aud": "kizuna-pilot",
        "sub": USER,
        "org_id": ORG,
        "roles": ["member", "reviewer"],
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return claims


@pytest.fixture(autouse=True)
def reset_caches():
    settings.cache_clear()
    keys.clear_caches()
    yield
    settings.cache_clear()
    keys.clear_caches()


def _encoded(key, **overrides) -> str:
    return jwt.encode(_claims(**overrides), key, algorithm="RS256")


def test_rs256_token_is_verified_against_a_published_jwk(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")

    token = _encoded(rsa_keypair)

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = rsa_keypair.public_key()
        principal = require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    assert str(principal.org_id) == ORG
    assert str(principal.user_id) == USER
    assert Role.REVIEWER in principal.roles
    assert Role.ADMIN not in principal.roles


def test_nested_roles_claim_is_resolved(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")
    monkeypatch.setenv("OIDC_ROLES_CLAIM", "resource_access.kizuna-web.roles")

    nested = _claims(resource_access={"kizuna-web": {"roles": ["admin"]}})
    nested.pop("roles")
    assert _roles(nested, settings()) == frozenset({Role.ADMIN})

    assert resolve_claim(nested, settings().roles_claim) == ["admin"]


def test_custom_org_claim_is_mapped(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")
    monkeypatch.setenv("OIDC_ORG_CLAIM", "tenant.official")

    claims = _claims()
    claims.pop("org_id")
    claims.update({"tenant": {"official": "33333333-3333-3333-3333-333333333333"}})
    token = jwt.encode(claims, rsa_keypair, algorithm="RS256")

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = rsa_keypair.public_key()
        principal = require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    assert str(principal.org_id) == "33333333-3333-3333-3333-333333333333"


def test_missing_org_claim_is_unauthorised(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")

    claims = _claims()
    claims.pop("org_id")
    token = jwt.encode(claims, rsa_keypair, algorithm="RS256")

    from fastapi import HTTPException

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = rsa_keypair.public_key()
        with pytest.raises(HTTPException) as error:
            require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401


def test_wrong_audience_is_rejected(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")

    token = _encoded(rsa_keypair, aud="some-other-client")

    from fastapi import HTTPException

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = rsa_keypair.public_key()
        with pytest.raises(HTTPException) as error:
            require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401


def test_discovery_finds_jwks_uri(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.delenv("OIDC_JWKS_URL", raising=False)

    import urllib.request

    class _DiscoveredResponse:
        def __init__(self, payload):
            self._payload = payload

        def read(self):
            return json.dumps(self._payload).encode()

        def close(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exception):
            self.close()
            return False

    discovered = {"jwks_uri": "https://issuer.example.test/realms/kizuna/protocol/openid-connect/certs"}

    def fake_urlopen(request, timeout=None):
        assert str(request).endswith("/.well-known/openid-configuration")
        return _DiscoveredResponse(discovered)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    settings.cache_clear()
    keys.clear_caches()
    assert keys.jwks_url(settings()) == discovered["jwks_uri"]


def test_missing_jwks_endpoint_raises_unavailable(monkeypatch):
    settings.cache_clear()
    keys.clear_caches()
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.delenv("OIDC_JWKS_URL", raising=False)

    import urllib.error

    def failing(request, timeout=None):
        raise urllib.error.URLError("no route to host")

    import urllib.request

    monkeypatch.setattr(urllib.request, "urlopen", failing)

    with pytest.raises(keys.SigningKeyUnavailable):
        keys.jwks_url(settings())


def test_unknown_kid_reports_service_unavailable(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")

    from fastapi import HTTPException

    token = _encoded(rsa_keypair)

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("kid not found")
        with pytest.raises(HTTPException) as error:
            require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 503


def test_role_claim_ignoring_unknown_values(monkeypatch, rsa_keypair):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.example.test/certs")

    token = _encoded(rsa_keypair, roles=["member", "not-a-role", 7, None])

    with patch.object(keys, "_jwks_client") as client:
        client.return_value.get_signing_key_from_jwt.return_value.key = rsa_keypair.public_key()
        principal = require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))

    assert principal.roles == frozenset({Role.MEMBER})


def test_rs256_without_issuer_is_unauthorised(monkeypatch, rsa_keypair):
    monkeypatch.delenv("OIDC_ISSUER", raising=False)
    token = _encoded(rsa_keypair)

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as error:
        require_principal(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
    assert error.value.status_code == 401
    assert error.value.detail == "OIDC verifier is not configured"


def test_explicit_jwks_url_takes_priority(monkeypatch):
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.example.test/realms/kizuna")
    monkeypatch.setenv("OIDC_AUDIENCE", "kizuna-pilot")
    monkeypatch.setenv("OIDC_JWT_ALGORITHM", "RS256")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://explicit.example.test/keys")

    assert keys.jwks_url(settings()) == "https://explicit.example.test/keys"
