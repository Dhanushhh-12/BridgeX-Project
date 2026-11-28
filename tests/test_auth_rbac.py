"""
tests/test_auth_rbac.py - Step 14.15: Comprehensive Authentication, JWT,
Password Hashing, Token Revocation, CORS, and RBAC Security Tests.

All tests run against an isolated temporary SQLite database (via BRIDGEX_DB_PATH)
and explicit synthetic test credentials so production data is never touched.
"""

from datetime import timedelta
import secrets
import sqlite3

from fastapi.testclient import TestClient
import pytest

from backend.api.api import app
from backend.db.database import ensure_database_initialized, reset_db_init_cache
from backend.services import auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_auth_db(monkeypatch, tmp_path):
    db_file = tmp_path / "test_bridgex_auth.db"
    test_secret = secrets.token_urlsafe(48)
    monkeypatch.setenv("BRIDGEX_DB_PATH", str(db_file))
    monkeypatch.setenv("BRIDGEX_JWT_SECRET", test_secret)
    reset_db_init_cache()
    ensure_database_initialized(str(db_file))
    yield db_file
    reset_db_init_cache()


def _register_and_headers(username: str, email: str, password: str = "BridgeTest99!"):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "full_name": f"{username} Display",
            "password": password,
        },
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return resp.json(), {"Authorization": f"Bearer {token}"}


def test_registration_stores_argon2id_hash_and_never_exposes_secrets(isolated_auth_db):
    reg_body, headers = _register_and_headers("viewer_one", "ViewerOne@Example.org")
    user = reg_body["user"]
    assert user["role"] == "viewer"
    assert user["email"] == "viewerone@example.org"
    assert "password" not in str(reg_body).lower()
    assert "password_hash" not in user

    # Verify Argon2id hash stored in SQLite directly
    conn = sqlite3.connect(str(isolated_auth_db))
    row = conn.execute("SELECT password_hash, role FROM users WHERE id = ?;", (user["id"],)).fetchone()
    conn.close()
    assert row is not None
    assert row[0].startswith("$argon2id$")
    assert row[1] == "viewer"

    # Profile endpoint returns sanitized user info
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "viewer_one"
    assert "password_hash" not in me.json()["user"]


def test_public_registration_rejects_client_role_elevation_and_duplicates():
    bad = client.post(
        "/api/v1/auth/register",
        json={
            "username": "elevated_try",
            "email": "elevated@example.org",
            "full_name": "Attempt",
            "password": "SafePassword123!",
            "role": "administrator",
        },
    )
    assert bad.status_code == 422

    _register_and_headers("dup_user", "dup@example.org")
    dup_email = client.post(
        "/api/v1/auth/register",
        json={
            "username": "other_name",
            "email": "DUP@EXAMPLE.ORG",
            "full_name": "Duplicate Email",
            "password": "SafePassword123!",
        },
    )
    assert dup_email.status_code == 409

    dup_username = client.post(
        "/api/v1/auth/register",
        json={
            "username": "DUP_USER",
            "email": "unique@example.org",
            "full_name": "Duplicate Username",
            "password": "SafePassword123!",
        },
    )
    assert dup_username.status_code == 409


def test_login_with_email_or_username_and_failure_cases():
    _register_and_headers("site_eng", "site.eng@example.org", "EngPass2026!")

    by_email = client.post(
        "/api/v1/auth/login",
        json={"identifier": "SITE.ENG@example.org", "password": "EngPass2026!"},
    )
    assert by_email.status_code == 200
    assert by_email.json()["token_type"] == "bearer"

    by_username = client.post(
        "/api/v1/auth/login",
        json={"identifier": "site_eng", "password": "EngPass2026!"},
    )
    assert by_username.status_code == 200

    wrong_pw = client.post(
        "/api/v1/auth/login",
        json={"identifier": "site_eng", "password": "WrongPassword99"},
    )
    assert wrong_pw.status_code == 401

    missing_creds = client.post("/api/v1/auth/login", json={"identifier": "", "password": ""})
    assert missing_creds.status_code == 422


def test_unauthenticated_expired_and_invalid_tokens_rejected():
    # Missing token on protected endpoints
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/users").status_code == 401
    assert client.get("/api/v1/projects").status_code == 401

    # Invalid/malformed token
    bad_headers = {"Authorization": "Bearer not.a.valid.jwt.token"}
    assert client.get("/api/v1/auth/me", headers=bad_headers).status_code == 401

    # Expired token
    user = auth_service.create_user_account(
        username="exp_user",
        email="exp@example.org",
        full_name="Expired Test",
        password="ExpiredUser123!",
        role="viewer",
    )
    expired_token, _ = auth_service.create_access_token(user, expires_delta=timedelta(seconds=-10))
    exp_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert exp_resp.status_code == 401
    assert "expired" in exp_resp.json()["message"].lower()


def test_logout_revokes_token_immediately():
    _, headers = _register_and_headers("logout_user", "logout@example.org")
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    out = client.post("/api/v1/auth/logout", headers=headers)
    assert out.status_code == 200

    # Reusing logged-out token must fail with 401
    after = client.get("/api/v1/auth/me", headers=headers)
    assert after.status_code == 401


def test_rbac_enforcement_across_admin_pm_and_viewer():
    admin = auth_service.create_user_account(
        username="sys_admin",
        email="admin@example.org",
        full_name="System Admin",
        password="AdminStrongPassword1!",
        role="administrator",
    )
    pm = auth_service.create_user_account(
        username="pm_hyd",
        email="pm@example.org",
        full_name="Hyderabad PM",
        password="ManagerStrongPassword1!",
        role="project_manager",
        assigned_projects=["BX-DEMO-001"],
    )
    viewer = auth_service.create_user_account(
        username="obs_view",
        email="viewer@example.org",
        full_name="Audit Viewer",
        password="ViewerStrongPassword1!",
        role="viewer",
    )

    admin_token, _ = auth_service.create_access_token(admin)
    pm_token, _ = auth_service.create_access_token(pm)
    viewer_token, _ = auth_service.create_access_token(viewer)

    admin_h = {"Authorization": f"Bearer {admin_token}"}
    pm_h = {"Authorization": f"Bearer {pm_token}"}
    viewer_h = {"Authorization": f"Bearer {viewer_token}"}

    # 1. User management: Admin ONLY
    assert client.get("/api/v1/users", headers=admin_h).status_code == 200
    assert client.get("/api/v1/users", headers=pm_h).status_code == 403
    assert client.get("/api/v1/users", headers=viewer_h).status_code == 403
    assert client.patch(f"/api/v1/users/{viewer['id']}", json={"role": "administrator"}, headers=viewer_h).status_code == 403

    # Admin self-lockout protection
    assert client.patch(f"/api/v1/users/{admin['id']}", json={"role": "viewer"}, headers=admin_h).status_code == 400
    assert client.patch(f"/api/v1/users/{admin['id']}", json={"is_active": False}, headers=admin_h).status_code == 400

    # 2. Project scoping & mutations
    pm_projects = client.get("/api/v1/projects", headers=pm_h)
    assert pm_projects.status_code == 200
    pm_codes = [p["project_code"] for p in pm_projects.json()["projects"]]
    assert pm_codes == ["BX-DEMO-001"]

    # PM can update assigned BX-DEMO-001, forbidden on unassigned BX-DEMO-002
    assert client.patch("/api/v1/projects/BX-DEMO-001", json={"actual_progress_pct": 71.0}, headers=pm_h).status_code == 200
    assert client.patch("/api/v1/projects/BX-DEMO-002", json={"actual_progress_pct": 50.0}, headers=pm_h).status_code == 403
    assert client.post(
        "/api/v1/projects",
        json={
            "project_code": "BX-PM-TRY",
            "name": "Blocked Create",
            "project_type": "Arch Bridge",
            "location": "Hyderabad",
        },
        headers=pm_h,
    ).status_code == 403

    # Viewer is strictly read-only on projects
    assert client.get("/api/v1/projects", headers=viewer_h).status_code == 200
    assert client.patch("/api/v1/projects/BX-DEMO-001", json={"actual_progress_pct": 99.0}, headers=viewer_h).status_code == 403
    assert client.delete("/api/v1/projects/BX-DEMO-001", headers=viewer_h).status_code == 403

    # Admin can create, update, and delete projects
    created = client.post(
        "/api/v1/projects",
        json={
            "project_code": "BX-NEW-010",
            "name": "Tungabhadra Span",
            "project_type": "Arch Bridge",
            "location": "Kurnool",
        },
        headers=admin_h,
    )
    assert created.status_code == 201
    assert client.delete("/api/v1/projects/BX-NEW-010", headers=admin_h).status_code == 200


def test_cors_configured_for_frontend_origin_only():
    allowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"

    disallowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "https://untrusted.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in disallowed.headers
