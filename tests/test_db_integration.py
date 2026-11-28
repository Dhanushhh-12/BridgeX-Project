"""
tests/test_db_integration.py - Step 14.17: End-to-End Database, API,
Module Telemetry, RBAC Scoping, Pagination, and Analytics Integration Tests.

Uses an isolated temporary SQLite database via BRIDGEX_DB_PATH so production
records and user data are never modified or deleted.
"""

import secrets
import sqlite3

from fastapi.testclient import TestClient
import pytest

from backend.api.api import app
from backend.db.database import ensure_database_initialized, reset_db_init_cache
from backend.services import auth_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_integration_db(monkeypatch, tmp_path):
    db_file = tmp_path / "test_bridgex_integration.db"
    monkeypatch.setenv("BRIDGEX_DB_PATH", str(db_file))
    monkeypatch.setenv("BRIDGEX_JWT_SECRET", secrets.token_urlsafe(48))
    reset_db_init_cache()
    ensure_database_initialized(str(db_file))
    yield db_file
    reset_db_init_cache()


def _create_role_headers(role: str, username: str, assigned_projects=None):
    user = auth_service.create_user_account(
        username=username,
        email=f"{username}@example.org",
        full_name=f"{username} Full",
        password="IntTestPassword2026!",
        role=role,
        assigned_projects=assigned_projects or [],
    )
    token, _ = auth_service.create_access_token(user)
    return user, {"Authorization": f"Bearer {token}"}


def test_health_reports_database_connected():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"


def test_migrations_create_all_tables_and_preserve_seed_data(isolated_integration_db):
    conn = sqlite3.connect(str(isolated_integration_db))
    tables = {
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()
    }
    proj_count = conn.execute("SELECT COUNT(*) FROM projects;").fetchone()[0]
    task_count = conn.execute("SELECT COUNT(*) FROM construction_tasks;").fetchone()[0]
    conn.close()

    assert {
        "schema_migrations",
        "users",
        "revoked_tokens",
        "projects",
        "construction_tasks",
        "ml_predictions",
        "weather_observations",
        "cv_analyses",
        "generated_reports",
        "audit_logs",
    }.issubset(tables)
    assert proj_count == 7
    assert task_count == 10


def test_projects_tasks_and_progress_integration_with_pagination_and_rbac():
    _, admin_h = _create_role_headers("administrator", "int_admin")
    _, pm_h = _create_role_headers("project_manager", "int_pm", ["BX-DEMO-001"])
    _, viewer_h = _create_role_headers("viewer", "int_viewer")

    # Pagination on GET /api/v1/projects
    p_page = client.get("/api/v1/projects?limit=3&offset=0", headers=admin_h)
    assert p_page.status_code == 200
    assert p_page.json()["total"] == 7
    assert p_page.json()["count"] == 3
    assert p_page.json()["projects"][0]["latitude"] is not None

    # Create new project + task under it, retrieve details & progress
    created = client.post(
        "/api/v1/projects",
        json={
            "project_code": "BX-INT-100",
            "name": "Krishna Test Corridor",
            "project_type": "Arch Bridge",
            "location": "Hyderabad",
            "latitude": 17.401,
            "longitude": 78.491,
        },
        headers=admin_h,
    )
    assert created.status_code == 201

    task_resp = client.post(
        "/api/v1/projects/BX-INT-100/tasks",
        json={
            "task_code": "TSK-INT-101",
            "task_name": "Deep Caisson Foundation",
            "category": "Foundation Piling",
            "contractor": "Apex Builders",
            "planned_duration_days": 16,
            "planned_progress_pct": 50.0,
            "actual_progress_pct": 40.0,
            "status": "In Progress",
        },
        headers=admin_h,
    )
    assert task_resp.status_code == 201

    detail = client.get("/api/v1/projects/BX-INT-100", headers=admin_h)
    assert detail.status_code == 200
    assert detail.json()["project"]["task_count"] == 1

    prog = client.get("/api/v1/projects/BX-INT-100/progress", headers=admin_h)
    assert prog.status_code == 200
    assert prog.json()["task_metrics"]["total_tasks"] == 1
    assert prog.json()["task_metrics"]["mean_task_actual_progress_pct"] == 40.0

    # PM scoped strictly to assigned BX-DEMO-001 -> blocked on BX-INT-100
    assert client.get("/api/v1/projects/BX-INT-100/tasks", headers=pm_h).status_code == 403
    assert client.get("/api/v1/projects/BX-DEMO-001/tasks", headers=pm_h).status_code == 200

    # Viewer cannot create or update tasks
    assert (
        client.patch(
            "/api/v1/tasks/TSK-INT-101",
            json={"actual_progress_pct": 80.0},
            headers=viewer_h,
        ).status_code
        == 403
    )

    # Admin updates task -> persists and calculates progress
    upd = client.patch(
        "/api/v1/tasks/TSK-INT-101",
        json={"actual_progress_pct": 100.0, "status": "Completed"},
        headers=admin_h,
    )
    assert upd.status_code == 200
    assert upd.json()["task"]["status"] == "Completed"

    # Missing project returns 404
    assert client.get("/api/v1/projects/BX-DOES-NOT-EXIST", headers=admin_h).status_code == 404


def test_ml_weather_reports_and_analytics_database_telemetry(monkeypatch):
    _, admin_h = _create_role_headers("administrator", "tel_admin")
    _, viewer_h = _create_role_headers("viewer", "tel_viewer")

    # 1. ML Prediction logged into ml_predictions
    pred = client.post(
        "/predict",
        json={
            "task_type": "Excavation",
            "contractor": "Apex Builders",
            "planned_duration": 9,
            "crew_size": 15,
            "material_cost": 59161.84,
            "weather_risk": 2,
            "complexity_level": 5,
        },
    )
    assert pred.status_code == 200

    # 2. Mocked Open-Meteo Weather forecast logged as 'forecast' into weather_observations
    import backend.api.api as api_mod

    monkeypatch.setattr(
        api_mod,
        "get_rainfall_forecast",
        lambda latitude, longitude, days=7: (["2026-11-28", "2026-11-29"], [0.0, 9.2]),
    )
    w_resp = client.get("/weather?latitude=17.385&longitude=78.4867&days=2&threshold_mm=5")
    assert w_resp.status_code == 200
    assert w_resp.json()["record_kind"] == "forecast"

    # 3. Reports preview logged into generated_reports
    r_prev = client.post(
        "/api/v1/reports/preview",
        json={"report_type": "project_analytics", "project_id": "ALL"},
    )
    assert r_prev.status_code == 200

    # 4. Analytics endpoint reflects real SQLite DB counts + CSV stats
    assert client.get("/api/v1/analytics").status_code == 401
    analytics = client.get("/api/v1/analytics", headers=admin_h)
    assert analytics.status_code == 200
    counts = analytics.json()["database_counts"]
    assert counts["projects"] == 7
    assert counts["ml_predictions_logged"] >= 1
    assert counts["weather_forecasts_logged"] >= 1
    assert counts["reports_generated"] >= 1
    assert analytics.json()["csv_dataset"]["total_csv_rows"] == 6000

    # 5. Audit logs restricted from Viewer (403), accessible to Admin (200)
    assert client.get("/api/v1/audit-logs", headers=viewer_h).status_code == 403
    audits = client.get("/api/v1/audit-logs", headers=admin_h)
    assert audits.status_code == 200
