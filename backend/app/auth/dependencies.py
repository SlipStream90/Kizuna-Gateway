"""Server-side OIDC bearer authentication and organization role checks."""

from collections.abc import Callable
from typing import Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import keys
from app.auth.settings import OidcConfig, settings
from app.schemas.pilot import Principal, Role

_bearer = HTTPBearer(auto_error=False)


def resolve_claim(claims: dict[str, Any], path: str) -> Any:
    """Read a claim by dotted path, e.g. ``realm_access.roles``."""
    value: Any = claims
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def _roles(claims: dict[str, Any], config: OidcConfig) -> frozenset[Role]:
    """Map the configured roles claim onto known roles, ignoring anything else."""
    raw = resolve_claim(claims, config.roles_claim)
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return frozenset()
    roles = set()
    for candidate in raw:
        try:
            roles.add(Role(candidate))
        except (TypeError, ValueError):
            continue
    return frozenset(roles)


def require_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    """Verify a bearer JWT and return its tenant-scoped identity.

    The algorithm always comes from configuration, never from the untrusted
    token header, and the key is either the configured shared secret or one
    published by the issuer's JWKS endpoint.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    config = settings()
    if not config.is_configured():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "OIDC verifier is not configured")

    try:
        key = keys.signing_key(credentials.credentials, config)
    except keys.SigningKeyUnavailable:
        # A well-formed token with no reachable key is an IdP outage, not a bad
        # credential; surfacing 503 keeps clients from discarding valid tokens.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Signing keys unavailable") from None

    try:
        claims = jwt.decode(
            credentials.credentials,
            key,
            algorithms=[config.algorithm],
            issuer=config.issuer,
            audience=config.audience,
            leeway=config.leeway_seconds,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        org_id = UUID(str(resolve_claim(claims, config.org_claim)))
        user_id = UUID(str(claims["sub"]))
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid bearer token") from None

    return Principal(user_id=user_id, org_id=org_id, roles=_roles(claims, config))


def require_role(*roles: Role) -> Callable[[Principal], Principal]:
    """Return a FastAPI dependency that requires at least one supplied role."""
    if not roles:
        raise ValueError("at least one role is required")

    def dependency(principal: Principal = Depends(require_principal)) -> Principal:
        if principal.roles.isdisjoint(roles):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return principal

    return dependency
