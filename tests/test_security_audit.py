"""
tests/test_security_audit.py - Step 14.20: Automated Security & Guardrail Verification.
Verifies security HTTP response headers, auth no-store caching, RBAC mutation guards,
SQLi/path-traversal input rejection, and upload validation without altering persisted DB rows.
"""

import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from backend.api.api import MAX_IMAGE_PIXELS_TOTAL, app
from backend.db.database import reset_db_init_cache


@pytest.fixture()
def isolated_client(tmp_path, monkeypatch):
    db_file = tmp_path / "sec_audit.db"
    monkeypatch.setenv("BRIDGEX_DB_PATH", str(db_file))
    monkeypatch.setenv("BRIDGEX_JWT_SECRET", "sec-audit-test-secret-minimum-32-chars!!")
    reset_db_init_cache()
    return TestClient(app)


def test_security_response_headers_present(isolated_client):
    resp = isolated_client.get("/health")
    assert resp.status_code == 200
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
    assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "geolocation=()" in resp.headers.get("permissions-policy", "")


def test_auth_endpoints_set_no_store_cache_control(isolated_client):
    suffix = uuid.uuid4().hex[:6]
    reg = isolated_client.post(
        "/api/v1/auth/register",
        json={
            "username": f"sec_{suffix}",
            "email": f"sec_{suffix}@example.org",
            "full_name": "Security Auditor",
            "password": "AuditPassword2026!",
        },
    )
    assert reg.status_code == 201
    assert "no-store" in reg.headers.get("cache-control", "")
    assert "password_hash" not in reg.text


def test_viewer_blocked_from_mutations_and_admin_routes(isolated_client):
    suffix = uuid.uuid4().hex[:6]
    reg = isolated_client.post(
        "/api/v1/auth/register",
        json={
            "username": f"vw_{suffix}",
            "email": f"vw_{suffix}@example.org",
            "full_name": "Viewer Auditor",
            "password": "AuditPassword2026!",
        },
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Viewer cannot list users
    assert isolated_client.get("/api/v1/users", headers=headers).status_code == 403
    # Viewer cannot create or update projects
    assert (
        isolated_client.post(
            "/api/v1/projects",
            headers=headers,
            json={
                "project_code": "BX-SEC-99",
                "name": "Unauthorized Bridge",
                "project_type": "Arch Bridge",
                "location": "Hyderabad",
            },
        ).status_code
        == 403
    )
    assert (
        isolated_client.patch(
            "/api/v1/projects/BX-DEMO-001",
            headers=headers,
            json={"actual_progress_pct": 99.0},
        ).status_code
        == 403
    )
    # Viewer cannot mutate tasks
    assert (
        isolated_client.patch(
            "/api/v1/tasks/TSK-0001",
            headers=headers,
            json={"actual_progress_pct": 10.0},
        ).status_code
        == 403
    )


def test_sqli_and_invalid_project_code_rejected(isolated_client):
    suffix = uuid.uuid4().hex[:6]
    reg = isolated_client.post(
        "/api/v1/auth/register",
        json={
            "username": f"sqli_{suffix}",
            "email": f"sqli_{suffix}@example.org",
            "full_name": "SQLi Auditor",
            "password": "AuditPassword2026!",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    for bad_code in ["BX'; DROP TABLE users;--", "..%2Fsecret", "a"]:
        resp = isolated_client.get(f"/api/v1/projects/{bad_code}", headers=headers)
        assert resp.status_code in (400, 404)


def test_upload_rejects_non_image_and_huge_pixel_limit(isolated_client, monkeypatch):
    # Non-image payload rejected with 400
    bad_resp = isolated_client.post(
        "/analyze-image",
        files={"file": ("payload.jpg", b"#!/bin/sh\nrm -rf /\n", "image/jpeg")},
    )
    assert bad_resp.status_code == 400

    # Temporarily lower pixel cap to verify guard triggers without huge allocations
    import backend.api.api as api_mod

    monkeypatch.setattr(api_mod, "MAX_IMAGE_PIXELS_TOTAL", 100)
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color=(100, 120, 140)).save(buf, format="PNG")
    big_resp = isolated_client.post(
        "/analyze-image",
        files={"file": ("oversize_dims.png", buf.getvalue(), "image/png")},
    )
    assert big_resp.status_code == 400
    assert "pixel limit" in big_resp.json()["message"].lower()
    assert MAX_IMAGE_PIXELS_TOTAL == 40_000_000
