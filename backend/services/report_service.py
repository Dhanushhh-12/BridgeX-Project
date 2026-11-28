"""
backend/services/report_service.py - Step 14.14: Professional Report Preview,
ReportLab PDF Generation, and Formula-Safe UTF-8 CSV Export Service.

Uses only genuinely available project files and services:
  - data/construction_tasks.csv (6,000 synthetic task benchmark rows)
  - models/delay_predictor.pkl via predict.py
  - weather.py (Open-Meteo live precipitation forecasts)
  - data/images/reports/*.csv and data/images/segmented/
"""

from collections import defaultdict
import csv
from datetime import datetime, timezone
import io
import os
import re
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from config import CONTRACTORS, DATA_DIR, DATASET_PATH, MODEL_PATH, TASK_TYPES
from predict import load_trained_model, predict_duration
from weather import count_rainy_days, get_rainfall_forecast

REPORTS_IMAGES_DIR = os.path.join(DATA_DIR, "images", "reports")
SEGMENTED_IMAGES_DIR = os.path.join(DATA_DIR, "images", "segmented")

SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
FORMULA_PREFIX_RE = re.compile(r"^[=+\-@\t\r]")

# Exact AI Bridge X Editorial Palette mapped to ReportLab colors
HEX_IVORY = colors.HexColor("#F5F0E6")
HEX_BLUE = colors.HexColor("#183153")
HEX_CORAL = colors.HexColor("#F0785F")
HEX_SAND = colors.HexColor("#E8DFD0")
HEX_CHARCOAL = colors.HexColor("#292D32")
HEX_SAGE = colors.HexColor("#8B9B91")
HEX_WHITE = colors.HexColor("#FFFFFF")
HEX_BORDER = colors.HexColor("#DED7CB")

# Valid project references (ALL plus registered workspace sites for metadata & weather coordinates)
VALID_PROJECT_REFERENCES: dict[str, dict[str, Any]] = {
    "ALL": {
        "project_id": "ALL",
        "name": "All Available Backend Data",
        "location": "Hyderabad (Default Weather Coordinates)",
        "latitude": 17.385,
        "longitude": 78.4867,
        "is_demo_reference": False,
    },
    "BX-DEMO-001": {
        "project_id": "BX-DEMO-001",
        "name": "Musi River Arch Span (Demo Reference)",
        "location": "Hyderabad",
        "latitude": 17.385,
        "longitude": 78.4867,
        "is_demo_reference": True,
    },
    "BX-DEMO-002": {
        "project_id": "BX-DEMO-002",
        "name": "Krishna Deck Viaduct (Demo Reference)",
        "location": "Vijayawada",
        "latitude": 16.5062,
        "longitude": 80.648,
        "is_demo_reference": True,
    },
    "BX-DEMO-003": {
        "project_id": "BX-DEMO-003",
        "name": "Godavari Pier Rehab (Demo Reference)",
        "location": "Rajahmundry",
        "latitude": 17.0005,
        "longitude": 81.804,
        "is_demo_reference": True,
    },
    "BX-DEMO-004": {
        "project_id": "BX-DEMO-004",
        "name": "Outer Ring Overpass (Demo Reference)",
        "location": "Hyderabad",
        "latitude": 17.4401,
        "longitude": 78.3489,
        "is_demo_reference": True,
    },
    "BX-DEMO-005": {
        "project_id": "BX-DEMO-005",
        "name": "Hussain Sagar Steel Flyover (Demo Reference)",
        "location": "Secunderabad",
        "latitude": 17.4239,
        "longitude": 78.4738,
        "is_demo_reference": True,
    },
    "BX-DEMO-006": {
        "project_id": "BX-DEMO-006",
        "name": "Amaravati Cable Approaches (Demo Reference)",
        "location": "Vijayawada",
        "latitude": 16.5193,
        "longitude": 80.6305,
        "is_demo_reference": True,
    },
    "BX-DEMO-007": {
        "project_id": "BX-DEMO-007",
        "name": "Kovvur Approach Resurfacing (Demo Reference)",
        "location": "Rajahmundry",
        "latitude": 17.0112,
        "longitude": 81.7279,
        "is_demo_reference": True,
    },
}

REPORT_CATALOG: list[dict[str, Any]] = [
    {
        "report_type": "construction_progress",
        "title": "Construction Progress & Stage Duration Report",
        "description": (
            "Task duration benchmarks and stage-level variance across the 6,000 synthetic "
            "tasks stored in construction_tasks.csv."
        ),
        "available": True,
        "unavailable_reason": None,
        "data_source": "Synthetic Dataset (data/construction_tasks.csv)",
        "supports_chart": True,
    },
    {
        "report_type": "ml_prediction",
        "title": "ML Delay Prediction & Evaluation Report",
        "description": (
            "Live XGBoost actual_duration benchmark predictions across construction stages "
            "plus verified held-out test metrics (MAE, RMSE, R2)."
        ),
        "available": True,
        "unavailable_reason": None,
        "data_source": "Trained XGBoost Model (models/delay_predictor.pkl)",
        "supports_chart": True,
    },
    {
        "report_type": "weather_risk",
        "title": "Weather Risk & Precipitation Forecast Report",
        "description": (
            "Live Open-Meteo daily rainfall forecast and rainy-day counts using "
            "weather.count_rainy_days() for the selected site coordinates."
        ),
        "available": True,
        "unavailable_reason": None,
        "data_source": "Live Open-Meteo API via weather.py",
        "supports_chart": True,
    },
    {
        "report_type": "computer_vision",
        "title": "Computer Vision Site Analysis Report",
        "description": (
            "Visual pixel difference scores, ADE20K semantic region shifts, and validation "
            "status from saved CV comparison reports."
        ),
        "available": True,
        "unavailable_reason": None,
        "data_source": "Saved CV Outputs (SegFormer ADE20K & Pillow/NumPy)",
        "supports_chart": True,
    },
    {
        "report_type": "project_analytics",
        "title": "Project & Contractor Analytics Report",
        "description": (
            "Contractor-level task counts, mean planned vs. actual days, overrun averages, "
            "and material cost totals from construction_tasks.csv."
        ),
        "available": True,
        "unavailable_reason": None,
        "data_source": "Synthetic Dataset (data/construction_tasks.csv)",
        "supports_chart": True,
    },
    {
        "report_type": "executive_summary",
        "title": "Executive Project Summary (Per-Project DB)",
        "description": (
            "Per-project executive dossier covering budgets, assigned project managers, "
            "milestone schedules, and persisted site logs."
        ),
        "available": False,
        "unavailable_reason": (
            "Unavailable: Backend does not yet include a persisted projects database "
            "(budgets, managers, and milestone dates do not exist in backend storage)."
        ),
        "data_source": "Requires Backend Projects Database",
        "supports_chart": False,
    },
]


class ReportValidationError(ValueError):
    """Raised when report_type, project_id, or filter arguments are invalid."""


class ReportUnavailableError(RuntimeError):
    """Raised when an upstream live dependency or model required by a report is unavailable."""


def _sanitize_csv_cell(value: Any) -> str:
    """Prevent spreadsheet CSV formula injection while keeping plain numbers clean."""
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    text = str(value).replace("\r\n", " ").replace("\n", " ").strip()
    if not text:
        return ""
    if FORMULA_PREFIX_RE.match(text):
        return "'" + text
    return text


def sanitize_export_filename(report_type: str, project_id: str, extension: str) -> str:
    """Build a safe download filename without path separators or unsafe characters."""
    raw = f"bridgex_{report_type}_{project_id}".lower()
    cleaned = SAFE_FILENAME_RE.sub("_", raw).strip("._-")
    if not cleaned:
        cleaned = "bridgex_report"
    return f"{cleaned}.{extension.lstrip('.')}"


def _read_csv_tasks(
    task_type: str | None = None,
    contractor: str | None = None,
) -> list[dict[str, str]]:
    """Read construction_tasks.csv safely with optional task_type/contractor filtering."""
    if not os.path.isfile(DATASET_PATH):
        raise ReportUnavailableError("Construction dataset file is unavailable on the server.")

    rows: list[dict[str, str]] = []
    with open(DATASET_PATH, mode="r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if task_type and row.get("task_type") != task_type:
                continue
            if contractor and row.get("contractor") != contractor:
                continue
            rows.append(row)
    return rows


def validate_report_request(
    report_type: str,
    project_id: str = "ALL",
    task_type: str | None = None,
    contractor: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Validate report_type, availability, project_id, and optional filters."""
    catalog_entry = next((r for r in REPORT_CATALOG if r["report_type"] == report_type), None)
    if catalog_entry is None:
        allowed = [r["report_type"] for r in REPORT_CATALOG if r["available"]]
        raise ReportValidationError(
            f"Unknown report_type '{report_type}'. Available types: {allowed}"
        )

    if not catalog_entry["available"]:
        raise ReportValidationError(
            catalog_entry["unavailable_reason"]
            or f"Report type '{report_type}' is currently unavailable."
        )

    cleaned_pid = (project_id or "ALL").strip()
    if cleaned_pid not in VALID_PROJECT_REFERENCES:
        raise ReportValidationError(
            f"Unknown project_id '{cleaned_pid}'. Expected one of: {list(VALID_PROJECT_REFERENCES.keys())}"
        )

    if task_type and task_type not in TASK_TYPES:
        raise ReportValidationError(f"Unknown task_type '{task_type}'. Expected one of: {TASK_TYPES}")

    if contractor and contractor not in CONTRACTORS:
        raise ReportValidationError(
            f"Unknown contractor '{contractor}'. Expected one of: {CONTRACTORS}"
        )

    return catalog_entry, VALID_PROJECT_REFERENCES[cleaned_pid]


def _build_construction_progress_report(
    project_ref: dict[str, Any],
    task_type: str | None,
    contractor: str | None,
    max_rows: int,
) -> dict[str, Any]:
    rows = _read_csv_tasks(task_type=task_type, contractor=contractor)
    if not rows:
        return {
            "executive_summary": (
                "No task records matched the selected task_type/contractor filter in construction_tasks.csv."
            ),
            "metrics": [
                {"label": "Matched Task Records", "value": "0"},
                {"label": "Dataset Source", "value": "construction_tasks.csv (Synthetic)"},
            ],
            "chart": None,
            "columns": ["Task ID", "Task Type", "Contractor", "Planned (d)", "Actual (d)", "Variance (d)"],
            "rows": [],
            "limitations": (
                "construction_tasks.csv stores synthetic duration records without calendar dates "
                "or physical completion percentages."
            ),
        }

    stage_buckets: dict[str, list[tuple[float, float]]] = defaultdict(list)
    total_planned = 0.0
    total_actual = 0.0
    overrun_count = 0

    for row in rows:
        p_days = float(row["planned_duration"])
        a_days = float(row["actual_duration"])
        total_planned += p_days
        total_actual += a_days
        if a_days > p_days:
            overrun_count += 1
        stage_buckets[row["task_type"]].append((p_days, a_days))

    n = len(rows)
    avg_planned = round(total_planned / n, 2)
    avg_actual = round(total_actual / n, 2)
    avg_var = round(avg_actual - avg_planned, 2)

    chart_labels: list[str] = []
    planned_series: list[float] = []
    actual_series: list[float] = []
    for st in TASK_TYPES:
        if st in stage_buckets:
            vals = stage_buckets[st]
            chart_labels.append(st.split()[0])
            planned_series.append(round(sum(x[0] for x in vals) / len(vals), 2))
            actual_series.append(round(sum(x[1] for x in vals) / len(vals), 2))

    limited_rows = rows[:max_rows]
    table_rows = []
    for r in limited_rows:
        p_d = float(r["planned_duration"])
        a_d = float(r["actual_duration"])
        table_rows.append([
            r["task_id"],
            r["task_type"],
            r["contractor"],
            f"{int(p_d)}",
            f"{a_d:.1f}",
            f"{a_d - p_d:+.1f}",
        ])

    return {
        "executive_summary": (
            f"Analyzed {n:,} synthetic construction task records (filter ref: {project_ref['project_id']}). "
            f"Mean planned duration is {avg_planned:.2f} days vs. {avg_actual:.2f} recorded actual days "
            f"(mean variance {avg_var:+.2f} days; {overrun_count:,} records exceeded planned days)."
        ),
        "metrics": [
            {"label": "Matched Tasks", "value": f"{n:,}"},
            {"label": "Rows Included in Export", "value": f"{len(table_rows):,}"},
            {"label": "Mean Planned Duration", "value": f"{avg_planned:.2f} days"},
            {"label": "Mean Actual Duration", "value": f"{avg_actual:.2f} days"},
        ],
        "chart": {
            "title": "Mean Planned vs. Recorded Actual Duration by Stage (days)",
            "labels": chart_labels,
            "series": [
                {"name": "Mean Planned (d)", "values": planned_series},
                {"name": "Mean Actual (d)", "values": actual_series},
            ],
        },
        "columns": ["Task ID", "Task Type", "Contractor", "Planned (d)", "Actual (d)", "Variance (d)"],
        "rows": table_rows,
        "limitations": (
            "Records come from the synthetic dataset construction_tasks.csv and contain duration "
            "days only—not calendar dates or real-world site completion percentages."
        ),
    }


def _build_ml_prediction_report(
    project_ref: dict[str, Any],
    contractor: str | None,
) -> dict[str, Any]:
    if not os.path.isfile(MODEL_PATH):
        raise ReportUnavailableError("Trained ML model (models/delay_predictor.pkl) is unavailable.")

    try:
        model = load_trained_model()
    except Exception as exc:
        raise ReportUnavailableError("Failed to load trained XGBoost model.") from exc

    chosen_contractor = contractor or "Apex Builders"
    benchmark_specs = [
        ("Site Preparation", chosen_contractor, 8, 10, 30000.0, 2, 4),
        ("Excavation", chosen_contractor, 9, 15, 59161.84, 2, 5),
        ("Foundation Piling", chosen_contractor, 18, 16, 130000.0, 3, 6),
        ("Concrete Pouring", chosen_contractor, 14, 20, 92500.0, 2, 6),
        ("Steel Erection", chosen_contractor, 24, 22, 185000.0, 3, 8),
        ("Bridge Decking", chosen_contractor, 20, 14, 145000.0, 4, 8),
        ("Asphalt Paving", chosen_contractor, 7, 12, 54000.0, 2, 4),
        ("Structural Inspection", chosen_contractor, 4, 6, 12000.0, 1, 3),
    ]

    table_rows: list[list[str]] = []
    labels: list[str] = []
    planned_series: list[float] = []
    predicted_series: list[float] = []

    for task_type, contr, planned, crew, cost, w_risk, comp in benchmark_specs:
        pred = predict_duration(
            model=model,
            task_type=task_type,
            contractor=contr,
            planned_duration=planned,
            crew_size=crew,
            material_cost=cost,
            weather_risk=w_risk,
            complexity_level=comp,
        )
        diff = round(pred - planned, 1)
        labels.append(task_type.split()[0])
        planned_series.append(float(planned))
        predicted_series.append(float(pred))
        table_rows.append([
            task_type,
            contr,
            str(planned),
            f"{pred:.1f}",
            f"{diff:+.1f}",
            f"{w_risk}/5",
            f"{comp}/10",
        ])

    return {
        "executive_summary": (
            f"Live XGBRegressor evaluation across all 8 bridge construction stages for "
            f"contractor '{chosen_contractor}' (Ref: {project_ref['project_id']}). "
            "Model predicts actual_duration in days (held-out synthetic test MAE 1.0081d, "
            "RMSE 1.2768d, R2 0.9744)."
        ),
        "metrics": [
            {"label": "Model Type", "value": "XGBRegressor (300 trees)"},
            {"label": "Target Variable", "value": "actual_duration (days)"},
            {"label": "Test MAE / RMSE", "value": "1.0081d / 1.2768d"},
            {"label": "Test R2 Score", "value": "0.9744 (97.44%)"},
        ],
        "chart": {
            "title": "Planned vs. Live XGBoost Predicted Actual Duration (days)",
            "labels": labels,
            "series": [
                {"name": "Planned (d)", "values": planned_series},
                {"name": "Predicted (d)", "values": predicted_series},
            ],
        },
        "columns": [
            "Task Type",
            "Contractor",
            "Planned (d)",
            "Predicted (d)",
            "Variance (d)",
            "Weather Risk",
            "Complexity",
        ],
        "rows": table_rows,
        "limitations": (
            "The trained regressor estimates task actual_duration in days from 7 inputs; it does "
            "not output project delay probability percentages or ingest live Open-Meteo rainfall."
        ),
    }


def _build_weather_risk_report(
    project_ref: dict[str, Any],
    days: int,
    threshold_mm: float,
) -> dict[str, Any]:
    try:
        dates, rainfall_amounts = get_rainfall_forecast(
            latitude=project_ref["latitude"],
            longitude=project_ref["longitude"],
            days=days,
        )
        rainy_days = count_rainy_days(rainfall_amounts, threshold_mm=threshold_mm)
    except ValueError as exc:
        raise ReportValidationError(str(exc)) from exc
    except RuntimeError as exc:
        raise ReportUnavailableError(
            "Live Open-Meteo weather forecast is currently unavailable."
        ) from exc

    total_rain = round(sum(rainfall_amounts), 2)
    table_rows = []
    for d_str, mm_val in zip(dates, rainfall_amounts):
        is_rainy = mm_val >= threshold_mm
        table_rows.append([
            d_str,
            f"{mm_val:.1f}",
            f"{threshold_mm:.1f}",
            "Rainy Day (>= threshold)" if is_rainy else "Dry Window",
        ])

    return {
        "executive_summary": (
            f"Live Open-Meteo {len(dates)}-day rainfall forecast for {project_ref['name']} "
            f"({project_ref['latitude']:.4f}, {project_ref['longitude']:.4f}). Total forecast "
            f"precipitation is {total_rain:.1f} mm with {rainy_days} rainy day(s) meeting or "
            f"exceeding the {threshold_mm:.1f} mm threshold."
        ),
        "metrics": [
            {"label": "Weather Source", "value": "Open-Meteo (Live)"},
            {"label": "Forecast Window", "value": f"{len(dates)} days"},
            {"label": "Rainy Days Count", "value": f"{rainy_days} / {len(dates)}"},
            {"label": "Total Rainfall", "value": f"{total_rain:.1f} mm"},
        ],
        "chart": {
            "title": "Daily Open-Meteo Rainfall Forecast (mm)",
            "labels": [d[5:] for d in dates],
            "series": [{"name": "Rainfall (mm)", "values": [round(v, 2) for v in rainfall_amounts]}],
        },
        "columns": ["Date", "Rainfall (mm)", "Threshold (mm)", "Classification"],
        "rows": table_rows,
        "limitations": (
            "weather.py fetches daily precipitation_sum only. Temperature, wind speed, and "
            "precipitation probability are unavailable. Threshold indicators are advisory only."
        ),
    }


def _build_computer_vision_report(project_ref: dict[str, Any]) -> dict[str, Any]:
    csv_files = (
        sorted(f for f in os.listdir(REPORTS_IMAGES_DIR) if f.lower().endswith(".csv"))
        if os.path.isdir(REPORTS_IMAGES_DIR)
        else []
    )
    mask_count = (
        len([f for f in os.listdir(SEGMENTED_IMAGES_DIR) if f.lower().endswith(".png")])
        if os.path.isdir(SEGMENTED_IMAGES_DIR)
        else 0
    )

    if not csv_files:
        return {
            "executive_summary": (
                f"No saved Computer Vision progress CSV reports exist yet (Masks saved: {mask_count})."
            ),
            "metrics": [
                {"label": "Saved CV Reports", "value": "0"},
                {"label": "Saved Mask PNGs", "value": str(mask_count)},
            ],
            "chart": None,
            "columns": ["Report Ref", "Image Diff %", "Changed Pixels %", "Semantic Shift %", "Validation"],
            "rows": [],
            "limitations": "Upload paired site photos via Computer Vision to generate CV reports.",
        }

    table_rows: list[list[str]] = []
    labels: list[str] = []
    img_diffs: list[float] = []
    sem_shifts: list[float] = []

    for idx, fname in enumerate(csv_files, start=1):
        fpath = os.path.join(REPORTS_IMAGES_DIR, fname)
        with open(fpath, mode="r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            first = next(reader, None)
            if not first:
                continue
        diff_pct = float(first.get("image_difference_score_pct") or 0.0)
        raw_pct = float(first.get("raw_changed_pixels_pct") or 0.0)
        sem_pct = float(first.get("semantic_region_change_pct") or 0.0)
        summary = str(first.get("visible_changes_summary") or "N/A")
        status = str(first.get("engineer_validation_status") or "Pending engineer review")
        ref_label = f"CV-{idx:02d}"
        labels.append(ref_label)
        img_diffs.append(round(diff_pct, 2))
        sem_shifts.append(round(sem_pct, 2))
        table_rows.append([
            fname,
            f"{diff_pct:.2f}%",
            f"{raw_pct:.2f}%",
            f"{sem_pct:.2f}%",
            summary[:55],
            status,
        ])

    return {
        "executive_summary": (
            f"Summarized {len(table_rows)} saved Computer Vision comparison report(s) and "
            f"{mask_count} saved SegFormer ADE20K mask(s) (Filter Ref: {project_ref['project_id']}). "
            "All visual ratios remain pending engineer validation."
        ),
        "metrics": [
            {"label": "Saved CV Reports", "value": str(len(table_rows))},
            {"label": "Saved Segmentation Masks", "value": str(mask_count)},
            {"label": "CV Model", "value": "SegFormer-B0 ADE20K"},
            {"label": "Validation Status", "value": "Pending engineer review"},
        ],
        "chart": {
            "title": "Visual Image Diff (%) vs. Semantic Shift (%) Across Saved CV Reports",
            "labels": labels,
            "series": [
                {"name": "Image Diff %", "values": img_diffs},
                {"name": "Semantic Shift %", "values": sem_shifts},
            ],
        },
        "columns": [
            "Report Filename",
            "Image Diff %",
            "Changed Pixels %",
            "Semantic Shift %",
            "Top ADE20K Shifts",
            "Validation",
        ],
        "rows": table_rows,
        "limitations": (
            "ADE20K segmentation and pixel difference metrics reflect visual changes (including "
            "lighting, camera angle, and weather) and are NOT verified construction completion %."
        ),
    }


def _build_project_analytics_report(
    project_ref: dict[str, Any],
    task_type: str | None,
    contractor: str | None,
) -> dict[str, Any]:
    rows = _read_csv_tasks(task_type=task_type, contractor=contractor)
    buckets: dict[str, dict[str, float]] = defaultdict(
        lambda: {"count": 0.0, "planned": 0.0, "actual": 0.0, "cost": 0.0}
    )

    for row in rows:
        c = row["contractor"]
        buckets[c]["count"] += 1
        buckets[c]["planned"] += float(row["planned_duration"])
        buckets[c]["actual"] += float(row["actual_duration"])
        buckets[c]["cost"] += float(row["material_cost"])

    table_rows: list[list[str]] = []
    labels: list[str] = []
    planned_series: list[float] = []
    actual_series: list[float] = []

    for c_name in sorted(buckets.keys()):
        b = buckets[c_name]
        cnt = int(b["count"])
        mean_p = round(b["planned"] / cnt, 2)
        mean_a = round(b["actual"] / cnt, 2)
        mean_var = round(mean_a - mean_p, 2)
        mean_cost = round(b["cost"] / cnt, 2)
        labels.append(c_name.split()[0])
        planned_series.append(mean_p)
        actual_series.append(mean_a)
        table_rows.append([
            c_name,
            f"{cnt:,}",
            f"{mean_p:.2f}",
            f"{mean_a:.2f}",
            f"{mean_var:+.2f}",
            f"${mean_cost:,.2f}",
        ])

    return {
        "executive_summary": (
            f"Aggregated {len(rows):,} synthetic construction task records across "
            f"{len(table_rows)} contractor(s) (Workspace Ref: {project_ref['project_id']})."
        ),
        "metrics": [
            {"label": "Total Analyzed Tasks", "value": f"{len(rows):,}"},
            {"label": "Contractors Covered", "value": str(len(table_rows))},
            {"label": "Dataset Source", "value": "construction_tasks.csv"},
            {"label": "ML Target Metric", "value": "actual_duration (days)"},
        ],
        "chart": {
            "title": "Mean Planned vs. Recorded Actual Duration by Contractor (days)",
            "labels": labels,
            "series": [
                {"name": "Mean Planned (d)", "values": planned_series},
                {"name": "Mean Actual (d)", "values": actual_series},
            ],
        },
        "columns": [
            "Contractor",
            "Task Count",
            "Mean Planned (d)",
            "Mean Actual (d)",
            "Mean Overrun (d)",
            "Mean Material Cost",
        ],
        "rows": table_rows,
        "limitations": (
            "Contractor metrics aggregate synthetic training records in construction_tasks.csv "
            "and do not reflect live persisted project contracts."
        ),
    }


def generate_report_payload(
    report_type: str,
    project_id: str = "ALL",
    days: int = 7,
    threshold_mm: float = 5.0,
    task_type: str | None = None,
    contractor: str | None = None,
    max_rows: int = 50,
) -> dict[str, Any]:
    """Build a structured, verified report payload ready for JSON preview, PDF, or CSV export."""
    catalog_entry, project_ref = validate_report_request(
        report_type=report_type,
        project_id=project_id,
        task_type=task_type,
        contractor=contractor,
    )

    if report_type == "construction_progress":
        body = _build_construction_progress_report(
            project_ref=project_ref,
            task_type=task_type,
            contractor=contractor,
            max_rows=max_rows,
        )
    elif report_type == "ml_prediction":
        body = _build_ml_prediction_report(project_ref=project_ref, contractor=contractor)
    elif report_type == "weather_risk":
        body = _build_weather_risk_report(
            project_ref=project_ref,
            days=days,
            threshold_mm=threshold_mm,
        )
    elif report_type == "computer_vision":
        body = _build_computer_vision_report(project_ref=project_ref)
    elif report_type == "project_analytics":
        body = _build_project_analytics_report(
            project_ref=project_ref,
            task_type=task_type,
            contractor=contractor,
        )
    else:
        raise ReportValidationError(f"Unsupported report_type '{report_type}'.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return {
        "report_type": report_type,
        "title": catalog_entry["title"],
        "data_source": catalog_entry["data_source"],
        "generated_at": generated_at,
        "project_reference": {
            "project_id": project_ref["project_id"],
            "name": project_ref["name"],
            "location": project_ref["location"],
            "is_demo_reference": project_ref["is_demo_reference"],
        },
        **body,
    }


def render_report_csv(payload: dict[str, Any]) -> bytes:
    """Serialize report rows to UTF-8 CSV with spreadsheet formula-injection sanitization."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["# AI Bridge X Report", _sanitize_csv_cell(payload["title"])])
    writer.writerow(["# Generated At", _sanitize_csv_cell(payload["generated_at"])])
    writer.writerow([
        "# Project Reference",
        _sanitize_csv_cell(
            f"{payload['project_reference']['project_id']} - {payload['project_reference']['name']}"
        ),
    ])
    writer.writerow(["# Data Source", _sanitize_csv_cell(payload["data_source"])])
    writer.writerow([])
    writer.writerow([_sanitize_csv_cell(col) for col in payload["columns"]])

    for row in payload["rows"]:
        writer.writerow([_sanitize_csv_cell(cell) for cell in row])

    return buffer.getvalue().encode("utf-8")


def _build_pdf_bar_chart(chart_data: dict[str, Any]) -> Drawing:
    """Create a vector ReportLab bar chart styled in Deep Editorial Blue and Coral Orange."""
    drawing = Drawing(470, 175)
    drawing.add(
        String(
            0,
            162,
            str(chart_data.get("title", "Chart Summary"))[:72],
            fontName="Helvetica-Bold",
            fontSize=9,
            fillColor=HEX_BLUE,
        )
    )

    chart = VerticalBarChart()
    chart.x = 34
    chart.y = 24
    chart.width = 420
    chart.height = 122

    series_list = chart_data.get("series") or []
    chart.data = [tuple(float(v) for v in s["values"]) for s in series_list]
    chart.categoryAxis.categoryNames = [str(lbl)[:10] for lbl in chart_data.get("labels", [])]
    chart.categoryAxis.labels.fontSize = 7
    chart.categoryAxis.labels.fillColor = HEX_CHARCOAL
    chart.valueAxis.labels.fontSize = 7
    chart.valueAxis.labels.fillColor = HEX_CHARCOAL
    chart.valueAxis.valueMin = 0
    chart.valueAxis.strokeColor = HEX_BORDER
    chart.categoryAxis.strokeColor = HEX_BORDER
    chart.groupSpacing = 8
    chart.barSpacing = 2

    palette = [HEX_BLUE, HEX_CORAL, HEX_SAGE]
    for idx in range(len(series_list)):
        chart.bars[idx].fillColor = palette[idx % len(palette)]
        chart.bars[idx].strokeColor = HEX_WHITE

    drawing.add(chart)
    return drawing


def render_report_pdf(payload: dict[str, Any]) -> bytes:
    """Generate a multi-page enterprise PDF report using ReportLab and AI Bridge X palette."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"AI Bridge X - {payload['title']}",
        author="AI Bridge X Platform",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "BXTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        textColor=HEX_WHITE,
        leading=20,
    )
    eyebrow_style = ParagraphStyle(
        "BXEyebrow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=HEX_CORAL,
        leading=11,
    )
    section_style = ParagraphStyle(
        "BXSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=HEX_BLUE,
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BXBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=HEX_CHARCOAL,
        leading=13,
    )
    cell_style = ParagraphStyle(
        "BXCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        textColor=HEX_CHARCOAL,
        leading=10,
    )
    header_cell_style = ParagraphStyle(
        "BXHeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=HEX_WHITE,
        leading=10,
    )

    elements: list[Any] = []

    # 1. Editorial Deep Blue Header Banner
    banner_table = Table(
        [
            [
                Paragraph("AI BRIDGE X — INTELLIGENT INFRASTRUCTURE PLATFORM", eyebrow_style),
            ],
            [
                Paragraph(xml_escape(str(payload["title"])), title_style),
            ],
            [
                Paragraph(
                    xml_escape(
                        f"Generated: {payload['generated_at']}  |  "
                        f"Reference: {payload['project_reference']['project_id']} "
                        f"({payload['project_reference']['name']})"
                    ),
                    ParagraphStyle("BXBannerMeta", parent=body_style, textColor=HEX_SAND, fontSize=8),
                )
            ],
        ],
        colWidths=[174 * mm],
    )
    banner_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HEX_BLUE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    elements.append(banner_table)
    elements.append(Spacer(1, 6 * mm))

    # 2. Executive Summary
    elements.append(Paragraph("Executive Summary", section_style))
    elements.append(Paragraph(xml_escape(str(payload["executive_summary"])), body_style))
    elements.append(Spacer(1, 4 * mm))

    # 3. Key Metrics Strip
    metrics = payload.get("metrics") or []
    if metrics:
        elements.append(Paragraph("Key Verified Metrics", section_style))
        metric_cols = [[Paragraph(xml_escape(str(m["label"])), ParagraphStyle("BXM", parent=cell_style, textColor=HEX_BLUE, fontName="Helvetica-Bold")) for m in metrics],
                       [Paragraph(xml_escape(str(m["value"])), ParagraphStyle("BXV", parent=cell_style, fontName="Helvetica-Bold", fontSize=10)) for m in metrics]]
        col_w = (174 * mm) / max(1, len(metrics))
        metric_tbl = Table(metric_cols, colWidths=[col_w] * len(metrics))
        metric_tbl.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HEX_SAND),
                ("BACKGROUND", (0, 1), (-1, 1), HEX_IVORY),
                ("BOX", (0, 0), (-1, -1), 0.75, HEX_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, HEX_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        elements.append(metric_tbl)
        elements.append(Spacer(1, 4 * mm))

    # 4. Vector Chart (when available)
    chart_data = payload.get("chart")
    if chart_data and chart_data.get("labels") and chart_data.get("series"):
        elements.append(Paragraph("Visual Analytics", section_style))
        elements.append(_build_pdf_bar_chart(chart_data))
        elements.append(Spacer(1, 4 * mm))

    # 5. Detailed Data Table (cap PDF visual rows safely at 250 to protect memory on 6,000-row requests)
    pdf_row_limit = 250
    all_rows = payload["rows"]
    pdf_rows = all_rows[:pdf_row_limit]
    table_heading = f"Detailed Report Records ({len(all_rows)} total"
    if len(all_rows) > pdf_row_limit:
        table_heading += f"; first {pdf_row_limit} shown in PDF — use Export CSV for full dataset)"
    else:
        table_heading += " rows)"
    elements.append(Paragraph(xml_escape(table_heading), section_style))

    if pdf_rows:
        num_cols = max(1, len(payload["columns"]))
        col_w = (174 * mm) / num_cols
        table_data = [[Paragraph(xml_escape(str(c)), header_cell_style) for c in payload["columns"]]]
        for r in pdf_rows:
            table_data.append([Paragraph(xml_escape(str(cell)), cell_style) for cell in r])

        data_table = Table(table_data, colWidths=[col_w] * num_cols, repeatRows=1)
        data_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HEX_BLUE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HEX_WHITE, HEX_IVORY]),
                ("BOX", (0, 0), (-1, -1), 0.75, HEX_BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, HEX_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ])
        )
        elements.append(data_table)
    else:
        elements.append(Paragraph("No tabular rows matched the selected report filters.", body_style))

    elements.append(Spacer(1, 5 * mm))
    elements.append(
        Paragraph(
            f"<b>Data Source &amp; Scope Disclaimer:</b> {xml_escape(str(payload['data_source']))}. "
            f"{xml_escape(str(payload['limitations']))}",
            ParagraphStyle("BXDisclaimer", parent=body_style, fontSize=8, textColor=HEX_CHARCOAL),
        )
    )

    def _draw_footer(canvas_obj, doc_obj):
        canvas_obj.saveState()
        canvas_obj.setStrokeColor(HEX_BORDER)
        canvas_obj.setLineWidth(0.6)
        canvas_obj.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(HEX_CHARCOAL)
        canvas_obj.drawString(
            18 * mm,
            10 * mm,
            "AI Bridge X Report — Informational analytics only; verify engineering decisions against site records.",
        )
        canvas_obj.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc_obj.page}")
        canvas_obj.restoreState()

    doc.build(elements, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    return buffer.getvalue()
