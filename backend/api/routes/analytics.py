"""
backend/api/routes/analytics.py - Step 14.17: Paginated tasks listing/updates,
unified platform database analytics (/api/v1/analytics), and audit logs.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from backend.api.deps import get_current_user, require_roles
from backend.db.database import get_db_connection, utc_now_iso
from backend.services.platform_db_service import (
    get_platform_analytics_summary,
    record_audit_event,
    serialize_task,
)

router = APIRouter(prefix="/api/v1", tags=["Platform Integration & Analytics"])


class TaskUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["Completed", "In Progress", "Pending", "Delayed"] | None = None
    actual_progress_pct: float | None = Field(default=None, ge=0.0, le=100.0, allow_inf_nan=False)
    actual_duration_days: float | None = Field(default=None, ge=0.1, le=1000.0, allow_inf_nan=False)


@router.get("/tasks")
def list_tasks(
    project_code: str | None = Query(default=None, max_length=40),
    status: str | None = Query(default=None, max_length=30),
    category: str | None = Query(default=None, max_length=60),
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user: dict = Depends(get_current_user),
):
    """List persisted construction tasks with RBAC project scoping and pagination."""
    role = current_user["role"]
    assigned = {c.upper() for c in current_user.get("assigned_projects", [])}

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT t.*, p.name AS project_name
            FROM construction_tasks t
            JOIN projects p ON lower(p.project_code) = lower(t.project_code)
            ORDER BY t.id ASC;
            """
        ).fetchall()

    tasks = [serialize_task(r) for r in rows]
    if role == "project_manager":
        tasks = [t for t in tasks if t["project_code"].upper() in assigned]

    if project_code and project_code.lower() != "all":
        tasks = [t for t in tasks if t["project_code"].lower() == project_code.strip().lower()]
    if status and status.lower() != "all":
        tasks = [t for t in tasks if t["status"].lower() == status.strip().lower()]
    if category and category.lower() != "all":
        tasks = [t for t in tasks if t["category"].lower() == category.strip().lower()]
    if search and search.strip():
        q = search.strip().lower()
        tasks = [
            t
            for t in tasks
            if q in t["task_code"].lower()
            or q in t["task_name"].lower()
            or q in t["project_code"].lower()
            or q in t["contractor"].lower()
            or q in t["category"].lower()
        ]

    total = len(tasks)
    paged = tasks[offset : offset + limit]

    return {
        "status": "success",
        "role": role,
        "scoped_to_assigned": role == "project_manager",
        "total": total,
        "count": len(paged),
        "tasks": paged,
    }


@router.patch("/tasks/{task_code}")
def update_task(
    task_code: str,
    payload: TaskUpdateRequest,
    current_user: dict = Depends(require_roles("administrator", "project_manager")),
):
    """Update task progress/status (Administrator or assigned Project Manager only)."""
    clean_code = task_code.strip().upper()
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM construction_tasks WHERE lower(task_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Task '{clean_code}' was not found.")

        if current_user["role"] == "project_manager":
            assigned = {c.upper() for c in current_user.get("assigned_projects", [])}
            if row["project_code"].upper() not in assigned:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"Access denied: Project Manager is not assigned to project "
                        f"'{row['project_code']}'."
                    ),
                )

        next_status = payload.status if payload.status is not None else row["status"]
        next_actual_pct = (
            float(payload.actual_progress_pct)
            if payload.actual_progress_pct is not None
            else float(row["actual_progress_pct"])
        )
        next_actual_days = (
            float(payload.actual_duration_days)
            if payload.actual_duration_days is not None
            else row["actual_duration_days"]
        )

        conn.execute(
            """
            UPDATE construction_tasks
            SET status = ?, actual_progress_pct = ?, actual_duration_days = ?,
                updated_by = ?, updated_at = ?
            WHERE id = ?;
            """,
            (
                next_status,
                next_actual_pct,
                next_actual_days,
                current_user["id"],
                utc_now_iso(),
                row["id"],
            ),
        )
        updated = conn.execute(
            """
            SELECT t.*, p.name AS project_name
            FROM construction_tasks t
            JOIN projects p ON lower(p.project_code) = lower(t.project_code)
            WHERE t.id = ?;
            """,
            (row["id"],),
        ).fetchone()

    record_audit_event(
        action="task_updated",
        entity_type="construction_task",
        entity_id=clean_code,
        details=f"status={next_status}, progress={next_actual_pct}%",
        actor_user=current_user,
    )
    return {"status": "success", "task": serialize_task(updated)}


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    """Return aggregated live SQLite metrics, ML/CV/weather telemetry, and CSV benchmarks."""
    return get_platform_analytics_summary(current_user)


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user: dict = Depends(require_roles("administrator", "project_manager")),
):
    """Retrieve recent platform audit trail records (Administrator & Project Manager)."""
    with get_db_connection() as conn:
        total = conn.execute("SELECT COUNT(*) AS cnt FROM audit_logs;").fetchone()["cnt"]
        rows = conn.execute(
            """
            SELECT id, actor_username, actor_role, action, entity_type, entity_id, details, created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT ? OFFSET ?;
            """,
            (limit, offset),
        ).fetchall()

    return {
        "status": "success",
        "total": int(total),
        "count": len(rows),
        "logs": [dict(r) for r in rows],
    }
