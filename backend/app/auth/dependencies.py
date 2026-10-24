"""Server-side OIDC bearer authentication and organization role checks."""

import os
from collections.abc import Callable
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.pilot import Principal, Role

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def _settings() -> tuple[str, str, str, str]:
    issuer = os.getenv("OIDC_ISSUER", "")
    audience = os.getenv("OIDC_AUDIENCE", "")
    key = os.getenv("OIDC_SIGNING_KEY", "")
    algorithm = os.getenv("OIDC_JWT_ALGORITHM", "HS256")
    return issuer, audience, key, algorithm


def oidc_settings() -> tuple[str, str, str, str]:
    """Return the configured issuer, audience, signing key and algorithm."""
    return _settings()


def require_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    """Verify a bearer JWT and return its tenant-scoped identity.

    Production configuration must provide issuer, audience, signing key, and
    an explicitly permitted algorithm.  The implementation deliberately does
    not accept an algorithm selected by the untrusted JWT header.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    issuer, audience, key, algorithm = _settings()
    if (not issuer or not audience or not key or algorithm not in {"HS256", "RS256", "ES256"}
            or (algorithm == "HS256" and len(key.encode("utf-8")) < 32)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "OIDC verifier is not configured")
    try:
        claims = jwt.decode(
            credentials.credentials, key, algorithms=[algorithm], issuer=issuer, audience=audience,
            options={"require": ["exp", "iss", "aud", "sub", "org_id"]},
        )
        raw_roles = claims.get("roles", [])
        if not isinstance(raw_roles, list):
            raise ValueError("roles must be a list")
        return Principal(user_id=UUID(claims["sub"]), org_id=UUID(claims["org_id"]), roles=frozenset(Role(role) for role in raw_roles))
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid bearer token") from None


def require_role(*roles: Role) -> Callable[[Principal], Principal]:
    """Return a FastAPI dependency that requires at least one supplied role."""
    if not roles:
        raise ValueError("at least one role is required")

    def dependency(principal: Principal = Depends(require_principal)) -> Principal:
        if principal.roles.isdisjoint(roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return principal

    return dependency
