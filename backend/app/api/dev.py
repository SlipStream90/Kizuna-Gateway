"""Development-only session issuance.

A real deployment receives bearer tokens from an external OIDC provider.  For
local demos there is no provider, so this module can mint an HS256 token with
the same issuer, audience and signing key the API verifies against.

It is inert unless ``DEV_AUTH_ENABLED`` is truthy, and it refuses to run when
the verifier is configured for an asymmetric algorithm (RS256/ES256), so a
production deployment that forgets to unset the flag cannot be handed tokens
it did not sign itself.
"""

from __future__ import annotations

import os
import time
from uuid import UUID

import jwt
from fastapi import APIRouter, HTTPException, status

from app.auth.settings import settings
from app.schemas.dev import DevSession

router = APIRouter(prefix="/dev", tags=["dev"])

DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
DEV_ORG_ID = "11111111-1111-1111-1111-111111111111"
MAX_TOKEN_TTL_SECONDS = 86_400
_TRUE = {"1", "true", "yes", "on"}


def enabled() -> bool:
    """Return whether local session issuance is switched on."""
    return os.getenv("DEV_AUTH_ENABLED", "").strip().lower() in _TRUE


def _token_ttl() -> int:
    raw = os.getenv("DEV_TOKEN_TTL_SECONDS", "3600").strip()
    try:
        ttl = int(raw)
    except ValueError:
        ttl = 3600
    return max(60, min(ttl, MAX_TOKEN_TTL_SECONDS))


@router.post("/session", response_model=DevSession)
def create_dev_session() -> DevSession:
    """Mint a short-lived bearer token for the seeded development organization."""
    # 404 keeps the endpoint invisible when it is switched off.
    if not enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")

    config = settings()
    if config.algorithm != "HS256":
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Dev sessions require HS256 signing")
    if not config.is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OIDC verifier is not configured")

    try:
        org_id = UUID(os.getenv("DEV_ORG_ID", DEV_ORG_ID).strip())
    except ValueError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DEV_ORG_ID must be a UUID") from None

    ttl = _token_ttl()
    issued_at = int(time.time())
    token = jwt.encode(
        {
            "iss": config.issuer,
            "aud": config.audience,
            "sub": str(DEV_USER_ID),
            config.org_claim: str(org_id),
            "roles": ["admin"],
            "iat": issued_at,
            "exp": issued_at + ttl,
        },
        config.signing_key,
        algorithm="HS256",
    )
    return DevSession(access_token=token, expires_in=ttl, user_id=DEV_USER_ID, org_id=org_id)
