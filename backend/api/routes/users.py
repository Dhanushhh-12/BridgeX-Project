"""
backend/api/routes/users.py - Step 14.15: Administrator-only user and role management routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.api.deps import require_roles
from backend.services.auth_service import (
    AuthValidationError,
    DuplicateAccountError,
    create_user_account,
    delete_user_by_admin,
    list_all_users,
    update_user_by_admin,
)
from backend.services.platform_db_service import record_audit_event

router = APIRouter(prefix="/api/v1/users", tags=["User Management"])


class AdminCreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=3, max_length=40)
    email: str = Field(..., min_length=5, max_length=120)
    full_name: str = Field(..., min_length=2, max_length=80)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="viewer")
    assigned_projects: list[str] = Field(default_factory=list)
    is_active: bool = Field(default=True)


class AdminUpdateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    assigned_projects: list[str] | None = Field(default=None)


@router.get("")
def get_users(admin_user: dict = Depends(require_roles("administrator"))):
    """List all workspace user accounts (Administrator only; excludes password hashes)."""
    users = list_all_users()
    return {
        "status": "success",
        "count": len(users),
        "users": users,
        "requested_by": admin_user["username"],
    }


@router.post("", status_code=201)
def create_user(
    payload: AdminCreateUserRequest,
    admin_user: dict = Depends(require_roles("administrator")),
):
    """Create a managed user with explicit role & project assignments (Administrator only)."""
    try:
        created = create_user_account(
            username=payload.username,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role=payload.role,
            assigned_projects=payload.assigned_projects,
            is_active=payload.is_active,
        )
    except DuplicateAccountError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AuthValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    record_audit_event(
        action="admin_user_created",
        entity_type="user",
        entity_id=str(created["id"]),
        details=f"Provisioned '{created['username']}' as {created['role']}",
        actor_user=admin_user,
    )
    return {
        "status": "success",
        "user": created,
        "created_by": admin_user["username"],
    }


@router.patch("/{user_id}")
def patch_user(
    user_id: int,
    payload: AdminUpdateUserRequest,
    admin_user: dict = Depends(require_roles("administrator")),
):
    """Update a user's role, active status, or assigned projects (Administrator only)."""
    try:
        updated = update_user_by_admin(
            target_user_id=user_id,
            acting_admin_id=admin_user["id"],
            role=payload.role,
            is_active=payload.is_active,
            assigned_projects=payload.assigned_projects,
        )
    except AuthValidationError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    record_audit_event(
        action="admin_user_updated",
        entity_type="user",
        entity_id=str(user_id),
        details=f"role={updated['role']}, active={updated['is_active']}",
        actor_user=admin_user,
    )
    return {
        "status": "success",
        "user": updated,
    }


@router.delete("/{user_id}")
def remove_user(
    user_id: int,
    admin_user: dict = Depends(require_roles("administrator")),
):
    """Delete a non-self user account (Administrator only)."""
    try:
        delete_user_by_admin(target_user_id=user_id, acting_admin_id=admin_user["id"])
    except AuthValidationError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    record_audit_event(
        action="admin_user_deleted",
        entity_type="user",
        entity_id=str(user_id),
        details="Account removed",
        actor_user=admin_user,
    )
    return {
        "status": "success",
        "deleted_user_id": user_id,
    }
