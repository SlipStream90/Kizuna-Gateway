"""Response contract for local development session issuance."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DevSession(BaseModel):
    """Short-lived bearer token handed to the local web client."""

    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: UUID
    org_id: UUID
