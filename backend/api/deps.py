"""
backend/api/deps.py - Step 14.15: FastAPI authentication & RBAC dependencies.
Validates JWT bearer tokens, checks token revocation, and enforces backend roles.
"""

from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.services.auth_service import (
    AuthenticationFailedError,
    decode_and_verify_token,
)

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> tuple[dict, dict]:
    """Authenticate the Bearer JWT and return (user_dict, claims_dict)."""
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return decode_and_verify_token(credentials.credentials)
    except AuthenticationFailedError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(session: tuple[dict, dict] = Depends(get_current_session)) -> dict:
    """Return the authenticated active user profile without sensitive fields."""
    return session[0]


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory enforcing one of allowed_roles on the backend."""
    allowed_set = {role.lower() for role in allowed_roles}

    def _role_guard(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"].lower() not in allowed_set:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Access denied: role '{current_user['role_label']}' does not have "
                    "permission to perform this operation."
                ),
            )
        return current_user

    return _role_guard
