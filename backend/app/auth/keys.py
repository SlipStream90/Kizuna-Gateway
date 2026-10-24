"""Verification key resolution: shared secret, or the issuer's published JWKS."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from functools import lru_cache
from typing import Any

import jwt

from app.auth.settings import OidcConfig

_DISCOVERY_TIMEOUT_SECONDS = 5
_JWKS_CACHE_LIFESPAN_SECONDS = 300


class SigningKeyUnavailable(RuntimeError):
    """Raised when the identity provider's keys cannot be obtained."""


@lru_cache(maxsize=8)
def discovery_document(issuer: str) -> dict[str, Any]:
    """Fetch and cache an issuer's OpenID configuration."""
    url = f"{issuer.rstrip('/')}/.well-known/openid-configuration"
    try:
        with urllib.request.urlopen(url, timeout=_DISCOVERY_TIMEOUT_SECONDS) as response:
            document = json.load(response)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise SigningKeyUnavailable(f"OpenID configuration unavailable at {url}") from error
    if not isinstance(document, dict):
        raise SigningKeyUnavailable(f"OpenID configuration at {url} is not an object")
    return document


def jwks_url(config: OidcConfig) -> str:
    """Return the configured JWKS URL, discovering it from the issuer if needed."""
    if config.jwks_url:
        return config.jwks_url
    document = discovery_document(config.issuer)
    uri = document.get("jwks_uri")
    if not isinstance(uri, str) or not uri:
        raise SigningKeyUnavailable(f"No jwks_uri published for issuer {config.issuer}")
    return uri


@lru_cache(maxsize=8)
def _jwks_client(uri: str) -> jwt.PyJWKClient:
    # PyJWKClient refreshes on an unknown `kid`, which is what makes IdP key
    # rotation safe without restarting the API.
    return jwt.PyJWKClient(
        uri,
        cache_keys=True,
        cache_jwk_set=True,
        lifespan=_JWKS_CACHE_LIFESPAN_SECONDS,
        timeout=_DISCOVERY_TIMEOUT_SECONDS,
    )


def signing_key(token: str, config: OidcConfig) -> Any:
    """Return the key that must have signed ``token``."""
    if config.uses_shared_secret:
        return config.signing_key
    try:
        return _jwks_client(jwks_url(config)).get_signing_key_from_jwt(token).key
    except jwt.PyJWKClientError as error:
        raise SigningKeyUnavailable("No matching signing key published by the issuer") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise SigningKeyUnavailable("Signing key endpoint unavailable") from error


def clear_caches() -> None:
    """Drop cached discovery and key sets (used by tests and config reloads)."""
    discovery_document.cache_clear()
    _jwks_client.cache_clear()
