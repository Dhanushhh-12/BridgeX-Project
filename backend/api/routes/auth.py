"""
backend/api/routes/auth.py - Step 14.15: Registration, login, logout, and profile endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.api.deps import get_current_session, get_current_user
from backend.services.auth_service import (
    AuthValidationError,
    AuthenticationFailedError,
    DuplicateAccountError,
    authenticate_user,
    create_access_token,
    create_user_account,
    revoke_token,
)
from backend.services.platform_db_service import record_audit_event

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    """Public registration schema; rejects unknown fields like client-supplied roles."""

    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=3, max_length=40)
    email: str = Field(..., min_length=5, max_length=120)
    full_name: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Sign-in payload accepting either email or username plus password."""

    model_config = ConfigDict(extra="forbid")

    identifier: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/register", status_code=201)
def register_account(payload: RegisterRequest):
    """Register a new Viewer user account (public self-signup never grants elevated roles)."""
    try:
        user = create_user_account(
            username=payload.username,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role="viewer",
            assigned_projects=[],
        )
    except DuplicateAccountError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AuthValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    token, expires_at = create_access_token(user)
    record_audit_event(
        action="user_registered",
        entity_type="user",
        entity_id=str(user["id"]),
        details=f"Registered viewer '{user['username']}'",
        actor_user=user,
    )
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "user": user,
    }


@router.post("/login")
def login_account(payload: LoginRequest):
    """Authenticate by email or username and return a signed JWT access token."""
    try:
        user = authenticate_user(payload.identifier, payload.password)
    except AuthenticationFailedError as exc:
        raise HTTPException(
            status_code=401,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    token, expires_at = create_access_token(user)
    record_audit_event(
        action="user_login",
        entity_type="user",
        entity_id=str(user["id"]),
        details="Authenticated via JWT",
        actor_user=user,
    )
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "expires_at": expires_at,
        "user": user,
    }


@router.post("/logout")
def logout_account(session: tuple[dict, dict] = Depends(get_current_session)):
    """Revoke the current JWT access token server-side until its natural expiration."""
    user, claims = session
    revoke_token(claims["jti"], claims["exp"])
    record_audit_event(
        action="user_logout",
        entity_type="user",
        entity_id=str(user["id"]),
        details="Token revoked server-side",
        actor_user=user,
    )
    return {
        "status": "success",
        "message": "Signed out cleanly and revoked active session token.",
    }


@router.get("/me")
def get_authenticated_profile(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile and backend-enforced permissions."""
    return {
        "status": "success",
        "user": current_user,
    }
