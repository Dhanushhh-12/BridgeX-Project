"""
tests/test_api_contract_audit.py - Step 14.20: Exhaustive 33-Operation HTTP Contract,
Payload/Schema Matching, Error Status, and CRUD Integration Test Suite.
"""

import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image
import pytest

from backend.api.api import app
from backend.db.database import reset_db_init_cache


@pytest.fixture()
def contract_env(tmp_path, monkeypatch):
    db_file = tmp_path / "contract_audit.db"
    monkeypatch.setenv("BRIDGEX_DB_PATH", str(db_file))
    monkeypatch.setenv("BRIDGEX_JWT_SECRET", "contract-audit-secret-32-chars-minimum!!")
    monkeypatch.setenv("BRIDGEX_ADMIN_USERNAME", "contract_admin")
    monkeypatch.setenv("BRIDGEX_ADMIN_EMAIL", "contract_admin@bridgex.local")
    monkeypatch.setenv("BRIDGEX_ADMIN_PASSWORD", "ContractAdmin2026!")
    reset_db_init_cache()

    from backend.services.auth_service import ensure_env_admin_if_configured

    ensure_env_admin_if_configured()
    client = TestClient(app)

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"identifier": "contract_admin@bridgex.local", "password": "ContractAdmin2026!"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    return client, admin_headers


def test_core_health_root_and_system_info_contracts(contract_env):
    client, _ = contract_env

    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["status"] == "running"

    health = client.get("/health")
    assert health.status_code == 200
    hb = health.json()
    assert {"status", "application", "version", "database"}.issubset(hb.keys())

    sys_info = client.get("/system-info")
    assert sys_info.status_code == 200
    sb = sys_info.json()
    assert {"application_name", "version", "backend_status"}.issubset(sb.keys())


def test_full_auth_users_projects_tasks_lifecycle_and_errors(contract_env):
    client, admin_h = contract_env
    suffix = uuid.uuid4().hex[:6]

    # 1. Auth register -> me -> login -> logout -> revoked 401
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"usr_{suffix}",
            "email": f"usr_{suffix}@example.org",
            "full_name": "Contract Viewer",
            "password": "ContractUser2026!",
        },
    )
    assert reg.status_code == 201
    viewer_token = reg.json()["access_token"]
    viewer_id = reg.json()["user"]["id"]
    viewer_h = {"Authorization": f"Bearer {viewer_token}"}

    me = client.get("/api/v1/auth/me", headers=viewer_h)
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "viewer"

    # Unauthenticated access rejected with 401
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/projects").status_code == 401
    assert client.get("/api/v1/tasks").status_code == 401
    assert client.get("/api/v1/analytics").status_code == 401

    # 2. Admin user CRUD + 404/409/422 checks
    users_list = client.get("/api/v1/users", headers=admin_h)
    assert users_list.status_code == 200
    assert users_list.json()["count"] >= 2

    created_pm = client.post(
        "/api/v1/users",
        headers=admin_h,
        json={
            "username": f"pm_{suffix}",
            "email": f"pm_{suffix}@example.org",
            "full_name": "Contract PM",
            "password": "ContractPm2026!",
            "role": "project_manager",
            "assigned_projects": ["BX-DEMO-001"],
            "is_active": True,
        },
    )
    assert created_pm.status_code == 201
    pm_id = created_pm.json()["user"]["id"]

    patched_pm = client.patch(
        f"/api/v1/users/{pm_id}",
        headers=admin_h,
        json={"assigned_projects": ["BX-DEMO-001", "BX-DEMO-002"]},
    )
    assert patched_pm.status_code == 200
    assert "BX-DEMO-002" in patched_pm.json()["user"]["assigned_projects"]

    # Missing user returns 404
    assert client.patch("/api/v1/users/999999", headers=admin_h, json={"is_active": False}).status_code == 404

    # 3. Projects CRUD (POST, GET list, GET detail, PATCH, PUT alias, GET tasks, POST task, GET progress, DELETE)
    proj_code = f"BX-CT-{suffix}".upper()
    create_proj = client.post(
        "/api/v1/projects",
        headers=admin_h,
        json={
            "project_code": proj_code,
            "name": "Contract Test Viaduct",
            "project_type": "Viaduct Deck",
            "location": "Hyderabad",
            "corridor": "Contract Corridor",
            "status": "Active",
            "planned_progress_pct": 40.0,
            "actual_progress_pct": 35.0,
            "latitude": 17.4,
            "longitude": 78.5,
            "notes": "Audit test",
        },
    )
    assert create_proj.status_code == 201
    assert create_proj.json()["project"]["project_code"] == proj_code

    # Duplicate project -> 409
    dup_proj = client.post(
        "/api/v1/projects",
        headers=admin_h,
        json={
            "project_code": proj_code,
            "name": "Dup Viaduct",
            "project_type": "Viaduct Deck",
            "location": "Hyderabad",
        },
    )
    assert dup_proj.status_code == 409

    # Empty body -> 422
    assert client.post("/api/v1/projects", headers=admin_h, json={}).status_code == 422

    # Missing project -> 404
    assert client.get("/api/v1/projects/BX-MISSING-999", headers=admin_h).status_code == 404

    # GET list & detail
    assert client.get("/api/v1/projects", headers=admin_h).status_code == 200
    detail = client.get(f"/api/v1/projects/{proj_code}", headers=admin_h)
    assert detail.status_code == 200

    # PATCH and PUT project
    assert client.patch(f"/api/v1/projects/{proj_code}", headers=admin_h, json={"actual_progress_pct": 55.0}).status_code == 200
    assert client.put(f"/api/v1/projects/{proj_code}", headers=admin_h, json={"actual_progress_pct": 60.0}).status_code == 200

    # Create task under project + list + progress + patch task
    task_code = f"TSK-CT-{suffix}".upper()
    add_task = client.post(
        f"/api/v1/projects/{proj_code}/tasks",
        headers=admin_h,
        json={
            "task_code": task_code,
            "task_name": "Contract Piling",
            "category": "Foundation Piling",
            "contractor": "Apex Builders",
            "planned_duration_days": 12,
            "planned_progress_pct": 50.0,
            "actual_progress_pct": 25.0,
            "status": "In Progress",
        },
    )
    assert add_task.status_code == 201

    proj_tasks = client.get(f"/api/v1/projects/{proj_code}/tasks", headers=admin_h)
    assert proj_tasks.status_code == 200
    assert proj_tasks.json()["total"] == 1

    proj_prog = client.get(f"/api/v1/projects/{proj_code}/progress", headers=admin_h)
    assert proj_prog.status_code == 200
    assert proj_prog.json()["task_metrics"]["total_tasks"] == 1

    patch_task = client.patch(
        f"/api/v1/tasks/{task_code}",
        headers=admin_h,
        json={"actual_progress_pct": 80.0, "actual_duration_days": 10.5},
    )
    assert patch_task.status_code == 200
    assert patch_task.json()["task"]["actual_progress_pct"] == 80.0

    # Global tasks, analytics, audit-logs
    assert client.get("/api/v1/tasks?limit=10&offset=0", headers=admin_h).status_code == 200
    analytics = client.get("/api/v1/analytics", headers=admin_h)
    assert analytics.status_code == 200
    assert "database_counts" in analytics.json()
    audit_logs = client.get("/api/v1/audit-logs?limit=10&offset=0", headers=admin_h)
    assert audit_logs.status_code == 200
    assert audit_logs.json()["count"] > 0

    # Cleanup test records
    assert client.delete(f"/api/v1/projects/{proj_code}", headers=admin_h).status_code == 200
    assert client.delete(f"/api/v1/users/{pm_id}", headers=admin_h).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=viewer_h).status_code == 200
    assert client.get("/api/v1/auth/me", headers=viewer_h).status_code == 401
    assert client.delete(f"/api/v1/users/{viewer_id}", headers=admin_h).status_code == 200


def test_ml_weather_reports_and_invalid_payloads(contract_env, monkeypatch):
    client, _ = contract_env

    # ML predict: empty body -> 422, boolean field -> 422, valid -> 200
    assert client.post("/predict", json={}).status_code == 422
    assert (
        client.post(
            "/predict",
            json={
                "task_type": "Excavation",
                "contractor": "Apex Builders",
                "planned_duration": True,
                "crew_size": 12,
                "material_cost": 40000,
                "weather_risk": 2,
                "complexity_level": 5,
            },
        ).status_code
        == 422
    )
    pred = client.post(
        "/predict",
        json={
            "task_type": "Excavation",
            "contractor": "Apex Builders",
            "planned_duration": 10,
            "crew_size": 14,
            "material_cost": 60000,
            "weather_risk": 2,
            "complexity_level": 5,
        },
    )
    assert pred.status_code == 200
    assert pred.json()["target"] == "actual_duration"
    assert isinstance(pred.json()["predicted_value"], (int, float))

    # Weather mocked contract check
    import backend.api.api as api_mod

    monkeypatch.setattr(
        api_mod,
        "get_rainfall_forecast",
        lambda latitude, longitude, days=7: (["2026-11-28"], [6.5]),
    )
    w_ok = client.get("/weather?latitude=17.385&longitude=78.4867&days=1&threshold_mm=5")
    assert w_ok.status_code == 200
    assert w_ok.json()["record_kind"] == "forecast"
    assert w_ok.json()["rainy_days_count"] == 1
    assert client.get("/weather?latitude=999&longitude=78.4").status_code == 422

    # Upload empty PNG test to verify validation path
    bad_up = client.post("/analyze-image", files={"file": ("empty.png", b"", "image/png")})
    assert bad_up.status_code == 400
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="PNG")
    assert client.post("/analyze-progress", files={"previous_image": ("a.png", buf.getvalue(), "image/png")}).status_code == 422
