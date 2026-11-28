"""
backend/api/routes/projects.py - Step 14.15 & 14.17: Role-protected SQLite project,
task, and progress records API.

Access rules enforced on the backend:
  - Administrator   : view, create, edit, and delete all project & task records.
  - Project Manager : view and update ONLY projects/tasks assigned to their account.
  - Viewer          : view permitted catalog projects & tasks (read-only; 403 on all mutations).
"""

import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from backend.api.deps import get_current_user, require_roles
from backend.db.database import get_db_connection, utc_now_iso
from backend.services.platform_db_service import record_audit_event, serialize_task
from config import CONTRACTORS, TASK_TYPES

router = APIRouter(prefix="/api/v1/projects", tags=["Projects (RBAC)"])

PROJECT_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{3,40}$")
TASK_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{3,40}$")


def _serialize_project(row: sqlite3.Row, task_count: int | None = None) -> dict:
    keys = set(row.keys())
    return {
        "id": int(row["id"]),
        "project_code": row["project_code"],
        "name": row["name"],
        "project_type": row["project_type"],
        "location": row["location"],
        "corridor": row["corridor"],
        "status": row["status"],
        "planned_progress_pct": float(row["planned_progress_pct"]),
        "actual_progress_pct": float(row["actual_progress_pct"]),
        "latitude": float(row["latitude"]) if "latitude" in keys and row["latitude"] is not None else None,
        "longitude": float(row["longitude"]) if "longitude" in keys and row["longitude"] is not None else None,
        "start_date": row["start_date"] if "start_date" in keys else "",
        "expected_completion": row["expected_completion"] if "expected_completion" in keys else "",
        "description": row["description"] if "description" in keys else "",
        "is_demo_reference": bool(row["is_demo_reference"]),
        "notes": row["notes"],
        "task_count": task_count,
        "updated_at": row["updated_at"],
    }


def _check_project_access(project_code: str, current_user: dict) -> str:
    clean_code = project_code.strip().upper()
    if not PROJECT_CODE_RE.match(clean_code):
        raise HTTPException(status_code=400, detail="Invalid project_code format.")
    if current_user["role"] == "project_manager":
        assigned = {c.upper() for c in current_user.get("assigned_projects", [])}
        if clean_code not in assigned:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Project Manager is not assigned to '{clean_code}'.",
            )
    return clean_code


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_code: str = Field(..., min_length=3, max_length=40)
    name: str = Field(..., min_length=3, max_length=120)
    project_type: str = Field(..., min_length=2, max_length=60)
    location: str = Field(..., min_length=2, max_length=80)
    corridor: str = Field(default="Custom Corridor", min_length=2, max_length=100)
    status: Literal["Active", "At Risk", "Completed"] = "Active"
    planned_progress_pct: float = Field(default=0.0, ge=0.0, le=100.0, allow_inf_nan=False)
    actual_progress_pct: float = Field(default=0.0, ge=0.0, le=100.0, allow_inf_nan=False)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0, allow_inf_nan=False)
    start_date: str = Field(default="", max_length=30)
    expected_completion: str = Field(default="", max_length=30)
    description: str = Field(default="", max_length=500)
    notes: str = Field(default="", max_length=500)


class ProjectUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["Active", "At Risk", "Completed"] | None = None
    planned_progress_pct: float | None = Field(default=None, ge=0.0, le=100.0, allow_inf_nan=False)
    actual_progress_pct: float | None = Field(default=None, ge=0.0, le=100.0, allow_inf_nan=False)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0, allow_inf_nan=False)
    notes: str | None = Field(default=None, max_length=500)


class TaskCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_code: str = Field(..., min_length=3, max_length=40)
    task_name: str = Field(..., min_length=3, max_length=140)
    category: str = Field(..., min_length=2, max_length=80)
    contractor: str = Field(..., min_length=2, max_length=80)
    planned_duration_days: int = Field(..., ge=1, le=365)
    actual_duration_days: float | None = Field(default=None, ge=0.1, le=1000.0, allow_inf_nan=False)
    planned_progress_pct: float = Field(default=0.0, ge=0.0, le=100.0, allow_inf_nan=False)
    actual_progress_pct: float = Field(default=0.0, ge=0.0, le=100.0, allow_inf_nan=False)
    status: Literal["Completed", "In Progress", "Pending", "Delayed"] = "Pending"
    crew_size: int = Field(default=12, ge=1, le=500)
    material_cost: float = Field(default=35000.0, ge=100.0, le=10000000.0, allow_inf_nan=False)
    weather_risk: int = Field(default=2, ge=1, le=5)
    complexity_level: int = Field(default=5, ge=1, le=10)
    reporting_period: Literal["7d", "14d", "30d"] = "7d"


@router.get("")
def list_projects(
    status: str | None = Query(default=None, max_length=30),
    location: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10000),
    current_user: dict = Depends(get_current_user),
):
    """List persisted SQLite projects permitted for the signed-in user's role with optional pagination."""
    role = current_user["role"]
    assigned = {c.upper() for c in current_user.get("assigned_projects", [])}

    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT p.*, COUNT(t.id) AS task_count
            FROM projects p
            LEFT JOIN construction_tasks t ON lower(t.project_code) = lower(p.project_code)
            GROUP BY p.id
            ORDER BY p.id ASC;
            """
        ).fetchall()

    serialized = [_serialize_project(r, task_count=int(r["task_count"])) for r in rows]
    if role == "project_manager":
        serialized = [p for p in serialized if p["project_code"].upper() in assigned]

    if status and status.lower() != "all":
        serialized = [p for p in serialized if p["status"].lower() == status.strip().lower()]
    if location and location.lower() != "all":
        serialized = [p for p in serialized if p["location"].lower() == location.strip().lower()]
    if search and search.strip():
        q = search.strip().lower()
        serialized = [
            p
            for p in serialized
            if q in p["project_code"].lower()
            or q in p["name"].lower()
            or q in p["location"].lower()
            or q in p["project_type"].lower()
        ]

    total = len(serialized)
    paged = serialized[offset : offset + limit]

    return {
        "status": "success",
        "role": role,
        "scoped_to_assigned": role == "project_manager",
        "total": total,
        "count": len(paged),
        "limit": limit,
        "offset": offset,
        "projects": paged,
    }


@router.get("/{project_code}")
def get_project_detail(
    project_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve a single persisted project record and live task/progress rollup."""
    clean_code = _check_project_access(project_code, current_user)
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_code}' was not found.")
        task_rows = conn.execute(
            "SELECT t.*, p.name AS project_name FROM construction_tasks t "
            "JOIN projects p ON lower(p.project_code) = lower(t.project_code) "
            "WHERE lower(t.project_code) = lower(?) ORDER BY t.id ASC;",
            (clean_code,),
        ).fetchall()

    tasks = [serialize_task(r) for r in task_rows]
    return {
        "status": "success",
        "project": _serialize_project(row, task_count=len(tasks)),
        "tasks": tasks,
    }


@router.get("/{project_code}/tasks")
def list_project_tasks(
    project_code: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve paginated SQLite construction tasks for a specific permitted project."""
    clean_code = _check_project_access(project_code, current_user)
    with get_db_connection() as conn:
        proj = conn.execute(
            "SELECT project_code, name FROM projects WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if proj is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_code}' was not found.")

        total = conn.execute(
            "SELECT COUNT(*) AS cnt FROM construction_tasks WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()["cnt"]
        rows = conn.execute(
            """
            SELECT t.*, p.name AS project_name
            FROM construction_tasks t
            JOIN projects p ON lower(p.project_code) = lower(t.project_code)
            WHERE lower(t.project_code) = lower(?)
            ORDER BY t.id ASC
            LIMIT ? OFFSET ?;
            """,
            (clean_code, limit, offset),
        ).fetchall()

    return {
        "status": "success",
        "project_code": proj["project_code"],
        "project_name": proj["name"],
        "total": int(total),
        "count": len(rows),
        "tasks": [serialize_task(r) for r in rows],
    }


@router.get("/{project_code}/progress")
def get_project_progress_summary(
    project_code: str,
    current_user: dict = Depends(get_current_user),
):
    """Return calculated construction progress metrics from SQLite project + task records."""
    clean_code = _check_project_access(project_code, current_user)
    with get_db_connection() as conn:
        proj = conn.execute(
            "SELECT * FROM projects WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if proj is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_code}' was not found.")
        tasks = conn.execute(
            "SELECT status, planned_progress_pct, actual_progress_pct FROM construction_tasks "
            "WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchall()

    total_tasks = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "Completed")
    delayed = sum(1 for t in tasks if t["status"] == "Delayed")
    mean_task_actual = (
        round(sum(float(t["actual_progress_pct"]) for t in tasks) / total_tasks, 1)
        if total_tasks > 0
        else None
    )

    return {
        "status": "success",
        "project_code": proj["project_code"],
        "project_status": proj["status"],
        "planned_progress_pct": float(proj["planned_progress_pct"]),
        "actual_progress_pct": float(proj["actual_progress_pct"]),
        "is_demo_reference": bool(proj["is_demo_reference"]),
        "task_metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": completed,
            "delayed_tasks": delayed,
            "mean_task_actual_progress_pct": mean_task_actual,
        },
    }


@router.post("/{project_code}/tasks", status_code=201)
def create_project_task(
    project_code: str,
    payload: TaskCreateRequest,
    current_user: dict = Depends(require_roles("administrator", "project_manager")),
):
    """Add a persisted construction task under a project (Administrator or assigned PM)."""
    clean_proj = _check_project_access(project_code, current_user)
    clean_task_code = payload.task_code.strip().upper()
    if not TASK_CODE_RE.match(clean_task_code):
        raise HTTPException(status_code=400, detail="Invalid task_code format.")
    if payload.category not in TASK_TYPES:
        raise HTTPException(status_code=400, detail=f"category must be one of: {TASK_TYPES}")
    if payload.contractor not in CONTRACTORS:
        raise HTTPException(status_code=400, detail=f"contractor must be one of: {CONTRACTORS}")

    now = utc_now_iso()
    with get_db_connection() as conn:
        proj = conn.execute(
            "SELECT project_code FROM projects WHERE lower(project_code) = lower(?);",
            (clean_proj,),
        ).fetchone()
        if proj is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_proj}' was not found.")

        dup = conn.execute(
            "SELECT id FROM construction_tasks WHERE lower(task_code) = lower(?);",
            (clean_task_code,),
        ).fetchone()
        if dup is not None:
            raise HTTPException(status_code=409, detail=f"Task '{clean_task_code}' already exists.")

        conn.execute(
            """
            INSERT INTO construction_tasks (
                task_code, project_code, task_name, category, contractor,
                planned_duration_days, actual_duration_days, planned_progress_pct,
                actual_progress_pct, status, crew_size, material_cost,
                weather_risk, complexity_level, reporting_period,
                is_demo_reference, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?);
            """,
            (
                clean_task_code,
                proj["project_code"],
                payload.task_name.strip(),
                payload.category,
                payload.contractor,
                payload.planned_duration_days,
                payload.actual_duration_days,
                float(payload.planned_progress_pct),
                float(payload.actual_progress_pct),
                payload.status,
                payload.crew_size,
                float(payload.material_cost),
                payload.weather_risk,
                payload.complexity_level,
                payload.reporting_period,
                current_user["id"],
                now,
                now,
            ),
        )
        created = conn.execute(
            """
            SELECT t.*, p.name AS project_name
            FROM construction_tasks t
            JOIN projects p ON lower(p.project_code) = lower(t.project_code)
            WHERE lower(t.task_code) = lower(?);
            """,
            (clean_task_code,),
        ).fetchone()

    record_audit_event(
        action="task_created",
        entity_type="construction_task",
        entity_id=clean_task_code,
        details=f"Added under {clean_proj} ({payload.category})",
        actor_user=current_user,
    )
    return {"status": "success", "task": serialize_task(created)}


@router.post("", status_code=201)
def create_project(
    payload: ProjectCreateRequest,
    admin_user: dict = Depends(require_roles("administrator")),
):
    """Create a new persisted project record (Administrator only)."""
    code = payload.project_code.strip().upper()
    if not PROJECT_CODE_RE.match(code):
        raise HTTPException(
            status_code=400,
            detail="project_code must be 3-40 alphanumeric, hyphen, or underscore characters.",
        )

    now = utc_now_iso()
    with get_db_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM projects WHERE lower(project_code) = lower(?);",
            (code,),
        ).fetchone()
        if existing is not None:
            raise HTTPException(status_code=409, detail=f"Project '{code}' already exists.")

        cursor = conn.execute(
            """
            INSERT INTO projects (
                project_code, name, project_type, location, corridor,
                status, planned_progress_pct, actual_progress_pct,
                latitude, longitude, start_date, expected_completion, description,
                is_demo_reference, notes, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?);
            """,
            (
                code,
                payload.name.strip(),
                payload.project_type.strip(),
                payload.location.strip(),
                payload.corridor.strip(),
                payload.status,
                float(payload.planned_progress_pct),
                float(payload.actual_progress_pct),
                payload.latitude,
                payload.longitude,
                payload.start_date.strip(),
                payload.expected_completion.strip(),
                payload.description.strip(),
                payload.notes.strip(),
                admin_user["id"],
                now,
                now,
            ),
        )
        created = conn.execute("SELECT * FROM projects WHERE id = ?;", (cursor.lastrowid,)).fetchone()

    record_audit_event(
        action="project_created",
        entity_type="project",
        entity_id=code,
        details=f"Created '{payload.name.strip()}' ({payload.location.strip()})",
        actor_user=admin_user,
    )
    return {"status": "success", "project": _serialize_project(created, task_count=0)}


@router.patch("/{project_code}")
@router.put("/{project_code}")
def update_project(
    project_code: str,
    payload: ProjectUpdateRequest,
    current_user: dict = Depends(require_roles("administrator", "project_manager")),
):
    """Update a project's progress or status (Administrator or assigned Project Manager only)."""
    clean_code = _check_project_access(project_code, current_user)

    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_code}' was not found.")

        next_status = payload.status if payload.status is not None else row["status"]
        next_planned = (
            float(payload.planned_progress_pct)
            if payload.planned_progress_pct is not None
            else float(row["planned_progress_pct"])
        )
        next_actual = (
            float(payload.actual_progress_pct)
            if payload.actual_progress_pct is not None
            else float(row["actual_progress_pct"])
        )
        next_lat = payload.latitude if payload.latitude is not None else row["latitude"]
        next_lon = payload.longitude if payload.longitude is not None else row["longitude"]
        next_notes = payload.notes.strip() if payload.notes is not None else row["notes"]

        conn.execute(
            """
            UPDATE projects
            SET status = ?, planned_progress_pct = ?, actual_progress_pct = ?,
                latitude = ?, longitude = ?, notes = ?, updated_by = ?, updated_at = ?
            WHERE id = ?;
            """,
            (
                next_status,
                next_planned,
                next_actual,
                next_lat,
                next_lon,
                next_notes,
                current_user["id"],
                utc_now_iso(),
                row["id"],
            ),
        )
        updated = conn.execute("SELECT * FROM projects WHERE id = ?;", (row["id"],)).fetchone()

    record_audit_event(
        action="project_updated",
        entity_type="project",
        entity_id=clean_code,
        details=f"status={next_status}, actual={next_actual}%",
        actor_user=current_user,
    )
    return {"status": "success", "project": _serialize_project(updated)}


@router.delete("/{project_code}")
def delete_project(
    project_code: str,
    admin_user: dict = Depends(require_roles("administrator")),
):
    """Delete a project record (Administrator only)."""
    clean_code = project_code.strip().upper()
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id FROM projects WHERE lower(project_code) = lower(?);",
            (clean_code,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Project '{clean_code}' was not found.")
        conn.execute("DELETE FROM projects WHERE id = ?;", (row["id"],))

    record_audit_event(
        action="project_deleted",
        entity_type="project",
        entity_id=clean_code,
        details="Deleted project record",
        actor_user=admin_user,
    )
    return {
        "status": "success",
        "deleted_project_code": clean_code,
        "deleted_by": admin_user["username"],
    }
