"""
backend/services/auth_service.py - Step 14.15: Argon2id password hashing,
PyJWT access-token issuance/verification, token revocation, and RBAC helpers.
"""

from datetime import datetime, timedelta, timezone
import json
import logging
import os
import re
import secrets
import sqlite3
import time
from typing import Any
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from backend.db.database import get_db_connection, utc_now_iso
from config import DATA_DIR

logger = logging.getLogger("bridgeX.auth")

VALID_ROLES = ("administrator", "project_manager", "viewer")

ROLE_LABELS: dict[str, str] = {
    "administrator": "Administrator",
    "project_manager": "Project Manager",
    "viewer": "Viewer",
}

ROLE_PERMISSIONS: dict[str, dict[str, bool]] = {
    "administrator": {
        "can_manage_users": True,
        "can_create_projects": True,
        "can_edit_projects": True,
        "can_delete_projects": True,
        "can_access_analytics": True,
        "can_run_predictions": True,
        "can_export_reports": True,
    },
    "project_manager": {
        "can_manage_users": False,
        "can_create_projects": False,
        "can_edit_projects": True,
        "can_delete_projects": False,
        "can_access_analytics": True,
        "can_run_predictions": True,
        "can_export_reports": True,
    },
    "viewer": {
        "can_manage_users": False,
        "can_create_projects": False,
        "can_edit_projects": False,
        "can_delete_projects": False,
        "can_access_analytics": True,
        "can_run_predictions": False,
        "can_export_reports": True,
    },
}

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,40}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
JWT_ALGORITHM = "HS256"
DEV_SECRET_FILE = os.path.join(DATA_DIR, ".jwt_dev_secret")

_password_hasher = PasswordHasher()
_cached_dev_secret: str | None = None


class AuthValidationError(ValueError):
    """Raised when user inputs fail validation or uniqueness rules."""


class DuplicateAccountError(AuthValidationError):
    """Raised when username or email is already registered."""


class AuthenticationFailedError(PermissionError):
    """Raised when credentials or JWT access token are missing, expired, or invalid."""


class AuthorizationForbiddenError(PermissionError):
    """Raised when an authenticated user lacks required role or project scope."""


def get_jwt_secret() -> str:
    """
    Resolve the JWT signing key from BRIDGEX_JWT_SECRET / JWT_SECRET_KEY.
    In local dev without an env var, generates & persists a runtime-only secret file
    under data/.jwt_dev_secret (gitignored). Never hardcodes a signing secret in code.
    """
    global _cached_dev_secret
    env_secret = (os.getenv("BRIDGEX_JWT_SECRET") or os.getenv("JWT_SECRET_KEY") or "").strip()
    if env_secret:
        if len(env_secret) < 16:
            raise RuntimeError("BRIDGEX_JWT_SECRET must be at least 16 characters long.")
        return env_secret

    if os.getenv("BRIDGEX_ENV", "").strip().lower() == "production":
        raise RuntimeError(
            "BRIDGEX_JWT_SECRET environment variable must be configured in production."
        )

    if _cached_dev_secret:
        return _cached_dev_secret

    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(DEV_SECRET_FILE):
        with open(DEV_SECRET_FILE, "r", encoding="utf-8") as fh:
            existing = fh.read().strip()
            if len(existing) >= 32:
                _cached_dev_secret = existing
                return _cached_dev_secret

    generated = secrets.token_urlsafe(48)
    with open(DEV_SECRET_FILE, "w", encoding="utf-8") as fh:
        fh.write(generated)
    logger.warning(
        "BRIDGEX_JWT_SECRET not set; generated local development key at %s (set env var in production).",
        DEV_SECRET_FILE,
    )
    _cached_dev_secret = generated
    return _cached_dev_secret


def get_token_expiry_minutes() -> int:
    raw = os.getenv("BRIDGEX_JWT_EXPIRE_MINUTES", "60").strip()
    try:
        val = int(raw)
    except ValueError:
        return 60
    return max(5, min(1440, val))


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using OWASP-recommended Argon2id."""
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored Argon2id hash."""
    if not plain_password or not stored_hash:
        return False
    try:
        return bool(_password_hasher.verify(stored_hash, plain_password))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def validate_username(username: str) -> str:
    cleaned = username.strip()
    if not USERNAME_RE.match(cleaned):
        raise AuthValidationError(
            "Username must be 3-40 characters using letters, numbers, '.', '_', or '-'."
        )
    return cleaned


def validate_email(email: str) -> str:
    cleaned = email.strip().lower()
    if len(cleaned) > 120 or not EMAIL_RE.match(cleaned):
        raise AuthValidationError("Please provide a valid email address.")
    return cleaned


def validate_password_strength(password: str) -> str:
    if len(password) < 8 or len(password) > 128:
        raise AuthValidationError("Password must be between 8 and 128 characters.")
    if not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
        raise AuthValidationError("Password must contain at least one letter and one number.")
    return password


def validate_role(role: str) -> str:
    cleaned = role.strip().lower()
    if cleaned not in VALID_ROLES:
        raise AuthValidationError(f"Invalid role '{role}'. Expected one of: {list(VALID_ROLES)}.")
    return cleaned


def serialize_user(row: sqlite3.Row) -> dict[str, Any]:
    """Convert a SQLite user row to a sanitized API dict (never exposes password_hash)."""
    try:
        assigned = json.loads(row["assigned_projects_json"] or "[]")
        if not isinstance(assigned, list):
            assigned = []
    except json.JSONDecodeError:
        assigned = []

    role = row["role"]
    return {
        "id": int(row["id"]),
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "role": role,
        "role_label": ROLE_LABELS.get(role, role),
        "is_active": bool(row["is_active"]),
        "assigned_projects": [str(item) for item in assigned],
        "permissions": ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["viewer"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_user_account(
    *,
    username: str,
    email: str,
    full_name: str,
    password: str,
    role: str = "viewer",
    assigned_projects: list[str] | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    """Create and persist a new user with an Argon2id password hash."""
    clean_username = validate_username(username)
    clean_email = validate_email(email)
    clean_full_name = full_name.strip()
    if len(clean_full_name) < 2 or len(clean_full_name) > 80:
        raise AuthValidationError("Full name must be between 2 and 80 characters.")
    validate_password_strength(password)
    clean_role = validate_role(role)
    clean_assigned = sorted({str(p).strip().upper() for p in (assigned_projects or []) if str(p).strip()})
    password_hash = hash_password(password)
    now = utc_now_iso()

    with get_db_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?);",
            (clean_username, clean_email),
        ).fetchone()
        if existing is not None:
            raise DuplicateAccountError("An account with this username or email already exists.")

        cursor = conn.execute(
            """
            INSERT INTO users (
                username, email, full_name, password_hash, role,
                is_active, assigned_projects_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                clean_username,
                clean_email,
                clean_full_name,
                password_hash,
                clean_role,
                1 if is_active else 0,
                json.dumps(clean_assigned),
                now,
                now,
            ),
        )
        new_row = conn.execute("SELECT * FROM users WHERE id = ?;", (cursor.lastrowid,)).fetchone()
        return serialize_user(new_row)


def authenticate_user(identifier: str, password: str) -> dict[str, Any]:
    """Verify email/username + password and return sanitized user dict."""
    clean_id = identifier.strip()
    if not clean_id or not password:
        raise AuthenticationFailedError("Email/username and password are required.")

    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?);",
            (clean_id, clean_id),
        ).fetchone()

        if row is None or not verify_password(password, row["password_hash"]):
            raise AuthenticationFailedError("Invalid email/username or password.")

        if not bool(row["is_active"]):
            raise AuthenticationFailedError("This user account has been deactivated by an administrator.")

        if _password_hasher.check_needs_rehash(row["password_hash"]):
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?;",
                (hash_password(password), utc_now_iso(), row["id"]),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?;", (row["id"],)).fetchone()

        return serialize_user(row)


def create_access_token(
    user: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> tuple[str, str]:
    """Sign a JWT access token carrying user ID, role, jti, iat, and exp."""
    now_dt = datetime.now(timezone.utc)
    delta = expires_delta if expires_delta is not None else timedelta(minutes=get_token_expiry_minutes())
    exp_dt = now_dt + delta
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "jti": uuid.uuid4().hex,
        "iat": int(now_dt.timestamp()),
        "exp": int(exp_dt.timestamp()),
    }
    token = jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return token, exp_dt.isoformat()


def decode_and_verify_token(token: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Verify JWT signature, expiry, revocation status, and active DB user."""
    if not token or not token.strip():
        raise AuthenticationFailedError("Missing authentication token.")

    try:
        claims = jwt.decode(token.strip(), get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except ExpiredSignatureError as exc:
        raise AuthenticationFailedError("Session token has expired. Please sign in again.") from exc
    except InvalidTokenError as exc:
        raise AuthenticationFailedError("Invalid authentication token.") from exc

    jti = str(claims.get("jti", "")).strip()
    sub = claims.get("sub")
    if not jti or not sub:
        raise AuthenticationFailedError("Malformed authentication token claims.")

    try:
        user_id = int(sub)
    except (TypeError, ValueError) as exc:
        raise AuthenticationFailedError("Invalid token subject claim.") from exc

    with get_db_connection() as conn:
        # Prune expired revocation records lazily
        conn.execute("DELETE FROM revoked_tokens WHERE expires_at < ?;", (int(time.time()),))

        revoked = conn.execute("SELECT jti FROM revoked_tokens WHERE jti = ?;", (jti,)).fetchone()
        if revoked is not None:
            raise AuthenticationFailedError("Session token has been logged out. Please sign in again.")

        user_row = conn.execute("SELECT * FROM users WHERE id = ?;", (user_id,)).fetchone()
        if user_row is None or not bool(user_row["is_active"]):
            raise AuthenticationFailedError("Authenticated user account is unavailable or inactive.")

        return serialize_user(user_row), claims


def revoke_token(jti: str, exp_timestamp: int) -> None:
    """Persist token JTI in revoked_tokens so logged-out tokens cannot be replayed."""
    with get_db_connection() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO revoked_tokens (jti, expires_at, revoked_at) VALUES (?, ?, ?);",
            (jti, int(exp_timestamp), utc_now_iso()),
        )


def list_all_users() -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY id ASC;").fetchall()
        return [serialize_user(r) for r in rows]


def update_user_by_admin(
    *,
    target_user_id: int,
    acting_admin_id: int,
    role: str | None = None,
    is_active: bool | None = None,
    assigned_projects: list[str] | None = None,
) -> dict[str, Any]:
    with get_db_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?;", (target_user_id,)).fetchone()
        if row is None:
            raise AuthValidationError(f"User ID {target_user_id} was not found.")

        next_role = validate_role(role) if role is not None else row["role"]
        next_active = (1 if is_active else 0) if is_active is not None else int(row["is_active"])

        if target_user_id == acting_admin_id:
            if next_role != "administrator":
                raise AuthValidationError("Administrators cannot remove their own administrator role.")
            if next_active == 0:
                raise AuthValidationError("Administrators cannot deactivate their own active account.")

        if assigned_projects is not None:
            clean_assigned = sorted({str(p).strip().upper() for p in assigned_projects if str(p).strip()})
            next_assigned_json = json.dumps(clean_assigned)
        else:
            next_assigned_json = row["assigned_projects_json"]

        conn.execute(
            """
            UPDATE users
            SET role = ?, is_active = ?, assigned_projects_json = ?, updated_at = ?
            WHERE id = ?;
            """,
            (next_role, next_active, next_assigned_json, utc_now_iso(), target_user_id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?;", (target_user_id,)).fetchone()
        return serialize_user(updated)


def delete_user_by_admin(*, target_user_id: int, acting_admin_id: int) -> None:
    if target_user_id == acting_admin_id:
        raise AuthValidationError("Administrators cannot delete their own signed-in account.")
    with get_db_connection() as conn:
        row = conn.execute("SELECT id FROM users WHERE id = ?;", (target_user_id,)).fetchone()
        if row is None:
            raise AuthValidationError(f"User ID {target_user_id} was not found.")
        conn.execute("DELETE FROM users WHERE id = ?;", (target_user_id,))


def ensure_env_admin_if_configured() -> None:
    """
    If BRIDGEX_ADMIN_USERNAME, BRIDGEX_ADMIN_EMAIL, and BRIDGEX_ADMIN_PASSWORD are all set
    in the environment, idempotently ensure that administrator account exists.
    """
    username = os.getenv("BRIDGEX_ADMIN_USERNAME", "").strip()
    email = os.getenv("BRIDGEX_ADMIN_EMAIL", "").strip()
    password = os.getenv("BRIDGEX_ADMIN_PASSWORD", "")
    if not (username and email and password):
        return
    try:
        create_user_account(
            username=username,
            email=email,
            full_name=os.getenv("BRIDGEX_ADMIN_FULLNAME", "Platform Administrator").strip()
            or "Platform Administrator",
            password=password,
            role="administrator",
            assigned_projects=[],
        )
        logger.info("Bootstrapped configured administrator account '%s'.", username)
    except DuplicateAccountError:
        pass
    except AuthValidationError as exc:
        logger.warning("Skipped BRIDGEX_ADMIN bootstrap due to validation error: %s", exc)
