"""OIDC verifier configuration.

Two verification modes are supported:

* ``HS256`` with a shared secret (local development, including the token the
  ``/api/v1/dev/session`` endpoint mints).
* ``RS256``/``ES256`` with keys discovered from the issuer's JWKS endpoint
  (any real identity provider).

The claim names are configurable because IdPs disagree: Auth0 and Keycloak
mappers emit a top-level ``org_id``, Keycloak's stock roles live at
``realm_access.roles``, and so on.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

SUPPORTED_ALGORITHMS = frozenset({"HS256", "RS256", "ES256"})


@dataclass(frozen=True)
class OidcConfig:
    """Immutable view of the environment the verifier needs."""

    issuer: str
    audience: str
    signing_key: str
    algorithm: str
    jwks_url: str
    org_claim: str
    roles_claim: str
    leeway_seconds: int

    @property
    def uses_shared_secret(self) -> bool:
        return self.algorithm == "HS256"

    def is_configured(self) -> bool:
        """Return whether enough settings exist to verify any token at all."""
        if not self.issuer or not self.audience or self.algorithm not in SUPPORTED_ALGORITHMS:
            return False
        if self.uses_shared_secret:
            return len(self.signing_key.encode("utf-8")) >= 32
        return True


def _positive_int(raw: str, fallback: int) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return fallback
    return value if value >= 0 else fallback


@lru_cache
def settings() -> OidcConfig:
    """Read and cache the verifier configuration from the environment."""
    return OidcConfig(
        issuer=os.getenv("OIDC_ISSUER", "").strip().rstrip("/"),
        audience=os.getenv("OIDC_AUDIENCE", "").strip(),
        signing_key=os.getenv("OIDC_SIGNING_KEY", ""),
        algorithm=os.getenv("OIDC_JWT_ALGORITHM", "HS256").strip().upper() or "HS256",
        jwks_url=os.getenv("OIDC_JWKS_URL", "").strip(),
        org_claim=os.getenv("OIDC_ORG_CLAIM", "org_id").strip() or "org_id",
        roles_claim=os.getenv("OIDC_ROLES_CLAIM", "roles").strip() or "roles",
        leeway_seconds=_positive_int(os.getenv("OIDC_LEEWAY_SECONDS", "60"), 60),
    )
