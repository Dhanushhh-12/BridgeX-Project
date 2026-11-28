"""
backend/api/routes/reports.py - Step 14.14: Report catalog, live preview,
ReportLab PDF download, and sanitized UTF-8 CSV export routes.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator

from backend.services.platform_db_service import record_generated_report
from backend.services.report_service import (
    REPORT_CATALOG,
    ReportUnavailableError,
    ReportValidationError,
    VALID_PROJECT_REFERENCES,
    generate_report_payload,
    render_report_csv,
    render_report_pdf,
    sanitize_export_filename,
)
from config import CONTRACTORS, TASK_TYPES

router = APIRouter(prefix="/api/v1/reports", tags=["Reports & Exports"])


class ReportGenerationRequest(BaseModel):
    """Validated parameters for generating a report preview, PDF, or CSV."""

    report_type: str = Field(..., min_length=1, max_length=60)
    project_id: str = Field(default="ALL", min_length=1, max_length=60)
    days: int = Field(default=7, ge=1, le=16)
    threshold_mm: float = Field(default=5.0, ge=0.0, le=500.0, allow_inf_nan=False)
    task_type: str | None = Field(default=None, max_length=80)
    contractor: str | None = Field(default=None, max_length=80)
    max_rows: int = Field(default=50, ge=1, le=6000)

    @field_validator("report_type", "project_id", "task_type", "contractor", mode="before")
    @classmethod
    def clean_optional_strings(cls, value):
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned if cleaned else None

    @field_validator("days", "threshold_mm", "max_rows", mode="before")
    @classmethod
    def reject_booleans(cls, value):
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid numeric parameters.")
        return value


@router.get("/catalog")
def get_reports_catalog():
    """Return available and unavailable report definitions plus supported filters."""
    return {
        "reports": REPORT_CATALOG,
        "projects": list(VALID_PROJECT_REFERENCES.values()),
        "task_types": TASK_TYPES,
        "contractors": CONTRACTORS,
    }


def _generate_or_raise(request: ReportGenerationRequest) -> dict:
    try:
        return generate_report_payload(
            report_type=request.report_type,
            project_id=request.project_id,
            days=request.days,
            threshold_mm=request.threshold_mm,
            task_type=request.task_type,
            contractor=request.contractor,
            max_rows=request.max_rows,
        )
    except ReportValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ReportUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/preview")
def preview_report(request: ReportGenerationRequest):
    """Generate a live structured report preview for the Reports dashboard."""
    payload = _generate_or_raise(request)
    record_generated_report(
        report_type=request.report_type,
        export_format="preview",
        project_id=request.project_id,
        row_count=len(payload.get("rows", [])),
    )
    return {
        "status": "success",
        **payload,
    }


@router.post("/export/pdf")
def export_report_pdf(request: ReportGenerationRequest):
    """Generate and stream a styled ReportLab PDF file for download."""
    payload = _generate_or_raise(request)
    pdf_bytes = render_report_pdf(payload)
    record_generated_report(
        report_type=request.report_type,
        export_format="pdf",
        project_id=request.project_id,
        row_count=len(payload.get("rows", [])),
    )
    filename = sanitize_export_filename(request.report_type, request.project_id, "pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/export/csv")
def export_report_csv(request: ReportGenerationRequest):
    """Generate and stream a formula-safe UTF-8 CSV file for download."""
    payload = _generate_or_raise(request)
    csv_bytes = render_report_csv(payload)
    record_generated_report(
        report_type=request.report_type,
        export_format="csv",
        project_id=request.project_id,
        row_count=len(payload.get("rows", [])),
    )
    filename = sanitize_export_filename(request.report_type, request.project_id, "csv")
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
