"""
backend/services/platform_db_service.py - Step 14.17: Centralized SQLite telemetry,
audit logging, task/progress queries, and platform analytics aggregation service.
"""

from collections import defaultdict
import csv
import os
import sqlite3
from typing import Any

from backend.db.database import get_db_connection, utc_now_iso
from config import DATASET_PATH


def record_audit_event(
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    details: str = "",
    actor_user: dict[str, Any] | None = None,
) -> None:
    """Record a non-sensitive audit entry safely without exposing passwords or tokens."""
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (
                    actor_user_id, actor_username, actor_role,
                    action, entity_type, entity_id, details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    actor_user["id"] if actor_user else None,
                    actor_user["username"] if actor_user else "anonymous",
                    actor_user["role"] if actor_user else "public",
                    action,
                    entity_type,
                    entity_id,
                    details[:400],
                    utc_now_iso(),
                ),
            )
    except Exception:
        # Telemetry/audit failures never break primary API responses
        pass


def record_ml_prediction(
    *,
    task_type: str,
    contractor: str,
    planned_duration: int,
    crew_size: int,
    material_cost: float,
    weather_risk: int,
    complexity_level: int,
    predicted_duration_days: float,
    project_code: str | None = None,
    requested_by: int | None = None,
) -> None:
    """Persist a completed ML duration inference record cleanly into SQLite."""
    try:
        with get_db_connection() as conn:
            valid_project = None
            if project_code:
                row = conn.execute(
                    "SELECT project_code FROM projects WHERE lower(project_code) = lower(?);",
                    (project_code.strip(),),
                ).fetchone()
                if row is not None:
                    valid_project = row["project_code"]

            conn.execute(
                """
                INSERT INTO ml_predictions (
                    project_code, requested_by, task_type, contractor,
                    planned_duration, crew_size, material_cost,
                    weather_risk, complexity_level, predicted_duration_days, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    valid_project,
                    requested_by,
                    task_type,
                    contractor,
                    int(planned_duration),
                    int(crew_size),
                    float(material_cost),
                    int(weather_risk),
                    int(complexity_level),
                    float(predicted_duration_days),
                    utc_now_iso(),
                ),
            )
    except Exception:
        pass


def record_weather_observation(
    *,
    latitude: float,
    longitude: float,
    forecast_days: int,
    threshold_mm: float,
    rainy_days_count: int,
    total_rainfall_mm: float,
    project_code: str | None = None,
) -> None:
    """Persist a live Open-Meteo weather query strictly labeled as 'forecast'."""
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO weather_observations (
                    project_code, latitude, longitude, forecast_days, threshold_mm,
                    rainy_days_count, total_rainfall_mm, record_kind, source, fetched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'forecast', 'Open-Meteo', ?);
                """,
                (
                    project_code,
                    float(latitude),
                    float(longitude),
                    int(forecast_days),
                    float(threshold_mm),
                    int(rainy_days_count),
                    float(total_rainfall_mm),
                    utc_now_iso(),
                ),
            )
    except Exception:
        pass


def record_cv_analysis(
    *,
    result_id: str,
    analysis_kind: str,
    project_code: str | None,
    model_name: str,
    image_diff_score_pct: float | None,
    semantic_change_pct: float | None,
    detected_classes_count: int,
    csv_report_path: str | None = None,
    html_report_path: str | None = None,
    mask_path: str | None = None,
    created_by: int | None = None,
) -> None:
    """Persist computer vision inspection metadata without fabricating completion percentages."""
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO cv_analyses (
                    result_id, analysis_kind, project_code, model_name,
                    image_diff_score_pct, semantic_change_pct, detected_classes_count,
                    csv_report_path, html_report_path, mask_path,
                    verification_status, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending engineer review', ?, ?);
                """,
                (
                    result_id,
                    analysis_kind,
                    project_code,
                    model_name,
                    image_diff_score_pct,
                    semantic_change_pct,
                    int(detected_classes_count),
                    csv_report_path,
                    html_report_path,
                    mask_path,
                    created_by,
                    utc_now_iso(),
                ),
            )
    except Exception:
        pass


def record_generated_report(
    *,
    report_type: str,
    export_format: str,
    project_id: str,
    row_count: int,
    generated_by: int | None = None,
) -> None:
    """Persist report generation history cleanly into SQLite."""
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO generated_reports (
                    report_type, export_format, project_id, row_count, generated_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                (report_type, export_format, project_id, int(row_count), generated_by, utc_now_iso()),
            )
    except Exception:
        pass


def serialize_task(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "task_code": row["task_code"],
        "project_code": row["project_code"],
        "project_name": row["project_name"] if "project_name" in row.keys() else row["project_code"],
        "task_name": row["task_name"],
        "category": row["category"],
        "contractor": row["contractor"],
        "planned_duration_days": int(row["planned_duration_days"]),
        "actual_duration_days": (
            float(row["actual_duration_days"]) if row["actual_duration_days"] is not None else None
        ),
        "planned_progress_pct": float(row["planned_progress_pct"]),
        "actual_progress_pct": float(row["actual_progress_pct"]),
        "status": row["status"],
        "crew_size": int(row["crew_size"]),
        "material_cost": float(row["material_cost"]),
        "weather_risk": int(row["weather_risk"]),
        "complexity_level": int(row["complexity_level"]),
        "reporting_period": row["reporting_period"],
        "is_demo_reference": bool(row["is_demo_reference"]),
        "updated_at": row["updated_at"],
    }


def _compute_csv_aggregates() -> dict[str, Any]:
    """Read real contractor & stage aggregates from data/construction_tasks.csv."""
    if not os.path.exists(DATASET_PATH):
        return {"total_csv_rows": 0, "contractors": [], "stages": []}

    contractor_stats: dict[str, dict[str, float]] = defaultdict(
        lambda: {"count": 0, "planned": 0.0, "actual": 0.0, "cost": 0.0}
    )
    stage_stats: dict[str, dict[str, float]] = defaultdict(
        lambda: {"count": 0, "planned": 0.0, "actual": 0.0}
    )
    total = 0

    with open(DATASET_PATH, "r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            total += 1
            c_name = row.get("contractor", "Unknown")
            t_type = row.get("task_type", "Unknown")
            p_dur = float(row.get("planned_duration", 0) or 0)
            a_dur = float(row.get("actual_duration", 0) or 0)
            m_cost = float(row.get("material_cost", 0) or 0)

            contractor_stats[c_name]["count"] += 1
            contractor_stats[c_name]["planned"] += p_dur
            contractor_stats[c_name]["actual"] += a_dur
            contractor_stats[c_name]["cost"] += m_cost

            stage_stats[t_type]["count"] += 1
            stage_stats[t_type]["planned"] += p_dur
            stage_stats[t_type]["actual"] += a_dur

    contractors_out = [
        {
            "contractor": name,
            "task_count": int(st["count"]),
            "mean_planned_days": round(st["planned"] / max(1, st["count"]), 2),
            "mean_actual_days": round(st["actual"] / max(1, st["count"]), 2),
            "mean_overrun_days": round((st["actual"] - st["planned"]) / max(1, st["count"]), 2),
            "mean_material_cost": round(st["cost"] / max(1, st["count"]), 2),
        }
        for name, st in sorted(contractor_stats.items())
    ]

    stages_out = [
        {
            "stage": name,
            "record_count": int(st["count"]),
            "mean_planned_days": round(st["planned"] / max(1, st["count"]), 2),
            "mean_actual_days": round(st["actual"] / max(1, st["count"]), 2),
        }
        for name, st in stage_stats.items()
    ]

    return {
        "total_csv_rows": total,
        "contractors": contractors_out,
        "stages": stages_out,
    }


def get_platform_analytics_summary(current_user: dict[str, Any]) -> dict[str, Any]:
    """Combine live SQLite counts, recent predictions/CV/audit rows, and CSV aggregates."""
    role = current_user["role"]
    assigned = {c.upper() for c in current_user.get("assigned_projects", [])}

    with get_db_connection() as conn:
        proj_rows = conn.execute("SELECT * FROM projects ORDER BY id ASC;").fetchall()
        if role == "project_manager":
            proj_rows = [r for r in proj_rows if r["project_code"].upper() in assigned]

        project_codes = [r["project_code"] for r in proj_rows]

        task_rows = conn.execute("SELECT * FROM construction_tasks ORDER BY id ASC;").fetchall()
        if role == "project_manager":
            task_rows = [r for r in task_rows if r["project_code"].upper() in assigned]

        pred_rows = conn.execute(
            "SELECT id, project_code, task_type, contractor, planned_duration, predicted_duration_days, created_at "
            "FROM ml_predictions ORDER BY id DESC LIMIT 10;"
        ).fetchall()
        pred_count = conn.execute("SELECT COUNT(*) AS cnt FROM ml_predictions;").fetchone()["cnt"]
        weather_count = conn.execute("SELECT COUNT(*) AS cnt FROM weather_observations;").fetchone()["cnt"]
        cv_count = conn.execute("SELECT COUNT(*) AS cnt FROM cv_analyses;").fetchone()["cnt"]
        report_count = conn.execute("SELECT COUNT(*) AS cnt FROM generated_reports;").fetchone()["cnt"]

        recent_cv = conn.execute(
            "SELECT result_id, analysis_kind, project_code, image_diff_score_pct, semantic_change_pct, verification_status, created_at "
            "FROM cv_analyses ORDER BY id DESC LIMIT 8;"
        ).fetchall()

        audit_rows = conn.execute(
            "SELECT id, actor_username, actor_role, action, entity_type, entity_id, details, created_at "
            "FROM audit_logs ORDER BY id DESC LIMIT 15;"
        ).fetchall()

    total_proj = len(proj_rows)
    active_proj = sum(1 for r in proj_rows if r["status"] == "Active")
    at_risk_proj = sum(1 for r in proj_rows if r["status"] == "At Risk")
    completed_proj = sum(1 for r in proj_rows if r["status"] == "Completed")
    avg_progress = (
        round(sum(float(r["actual_progress_pct"]) for r in proj_rows) / total_proj, 1)
        if total_proj > 0
        else None
    )

    total_tasks = len(task_rows)
    completed_tasks = sum(1 for t in task_rows if t["status"] == "Completed")
    delayed_tasks = sum(1 for t in task_rows if t["status"] == "Delayed")
    in_progress_tasks = sum(1 for t in task_rows if t["status"] == "In Progress")

    csv_aggs = _compute_csv_aggregates()

    return {
        "status": "success",
        "role": role,
        "scoped_to_assigned": role == "project_manager",
        "database_counts": {
            "projects": total_proj,
            "active_projects": active_proj,
            "at_risk_projects": at_risk_proj,
            "completed_projects": completed_proj,
            "average_project_progress_pct": avg_progress,
            "tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "delayed_tasks": delayed_tasks,
            "ml_predictions_logged": int(pred_count),
            "weather_forecasts_logged": int(weather_count),
            "cv_analyses_logged": int(cv_count),
            "reports_generated": int(report_count),
        },
        "accessible_project_codes": project_codes,
        "recent_predictions": [dict(r) for r in pred_rows],
        "recent_cv_analyses": [dict(r) for r in recent_cv],
        "recent_audit_logs": [dict(r) for r in audit_rows],
        "csv_dataset": csv_aggs,
    }
