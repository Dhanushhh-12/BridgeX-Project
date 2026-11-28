"""
tests/test_reports.py - Step 14.14: Automated tests for AI Bridge X Reports & Exports.
Tests catalog listing, live ReportLab PDF generation, UTF-8 CSV export, formula-injection
sanitization, invalid project IDs/report types, missing data, large reports, and API errors.
"""

from fastapi.testclient import TestClient

from backend.api.api import app
from backend.services import report_service

client = TestClient(app)


def test_reports_catalog_endpoint():
    resp = client.get("/api/v1/reports/catalog")
    assert resp.status_code == 200
    body = resp.json()
    report_map = {item["report_type"]: item for item in body["reports"]}
    assert report_map["construction_progress"]["available"] is True
    assert report_map["ml_prediction"]["available"] is True
    assert report_map["weather_risk"]["available"] is True
    assert report_map["computer_vision"]["available"] is True
    assert report_map["project_analytics"]["available"] is True
    assert report_map["executive_summary"]["available"] is False


def test_invalid_report_type_rejected():
    resp = client.post(
        "/api/v1/reports/preview",
        json={"report_type": "non_existent_report", "project_id": "ALL"},
    )
    assert resp.status_code == 400
    assert resp.json()["success"] is False


def test_unavailable_report_type_rejected():
    resp = client.post(
        "/api/v1/reports/export/pdf",
        json={"report_type": "executive_summary", "project_id": "BX-DEMO-001"},
    )
    assert resp.status_code == 400
    assert "Unavailable" in resp.json()["message"]


def test_invalid_project_id_rejected():
    for bad_id in ["UNKNOWN-999", "../secret", "proj;drop"]:
        resp = client.post(
            "/api/v1/reports/preview",
            json={"report_type": "construction_progress", "project_id": bad_id},
        )
        assert resp.status_code == 400


def test_pdf_export_construction_progress_and_ml_prediction():
    for rtype in ("construction_progress", "ml_prediction", "computer_vision", "project_analytics"):
        resp = client.post(
            "/api/v1/reports/export/pdf",
            json={"report_type": rtype, "project_id": "BX-DEMO-001", "max_rows": 25},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/pdf")
        assert "attachment; filename=" in resp.headers.get("content-disposition", "")
        assert resp.content.startswith(b"%PDF-")
        assert len(resp.content) > 1500


def test_csv_export_columns_and_formula_sanitization():
    # Direct formula injection guard verification
    assert report_service._sanitize_csv_cell("=CMD|'/C calc'!A0") == "'=CMD|'/C calc'!A0"
    assert report_service._sanitize_csv_cell("+SUM(1,2)") == "'+SUM(1,2)"
    assert report_service._sanitize_csv_cell("@malicious") == "'@malicious"
    assert report_service._sanitize_csv_cell(42.5) == "42.5"

    resp = client.post(
        "/api/v1/reports/export/csv",
        json={"report_type": "project_analytics", "project_id": "ALL"},
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    text = resp.content.decode("utf-8")
    assert "Contractor,Task Count,Mean Planned (d),Mean Actual (d),Mean Overrun (d),Mean Material Cost" in text
    assert "Apex Builders" in text
    assert "BridgeCore Engineering" in text


def test_weather_report_success_and_upstream_error(monkeypatch):
    monkeypatch.setattr(
        report_service,
        "get_rainfall_forecast",
        lambda latitude, longitude, days=7: (["2026-11-28", "2026-11-29"], [0.0, 12.4]),
    )
    resp = client.post(
        "/api/v1/reports/preview",
        json={"report_type": "weather_risk", "project_id": "BX-DEMO-002", "days": 2, "threshold_mm": 5.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["metrics"][2]["value"] == "1 / 2"
    assert data["rows"][1][3] == "Rainy Day (>= threshold)"

    # Simulate Open-Meteo failure -> 503
    def _fail(*args, **kwargs):
        raise RuntimeError("Upstream timeout")

    monkeypatch.setattr(report_service, "get_rainfall_forecast", _fail)
    err_resp = client.post(
        "/api/v1/reports/export/pdf",
        json={"report_type": "weather_risk", "project_id": "BX-DEMO-002", "days": 7},
    )
    assert err_resp.status_code == 503


def test_computer_vision_missing_data_graceful(monkeypatch, tmp_path):
    monkeypatch.setattr(report_service, "REPORTS_IMAGES_DIR", str(tmp_path / "empty_reports"))
    monkeypatch.setattr(report_service, "SEGMENTED_IMAGES_DIR", str(tmp_path / "empty_masks"))

    resp = client.post(
        "/api/v1/reports/preview",
        json={"report_type": "computer_vision", "project_id": "ALL"},
    )
    assert resp.status_code == 200
    assert resp.json()["rows"] == []


def test_large_report_6000_rows_csv_and_capped_pdf():
    csv_resp = client.post(
        "/api/v1/reports/export/csv",
        json={"report_type": "construction_progress", "project_id": "ALL", "max_rows": 6000},
    )
    assert csv_resp.status_code == 200
    lines = csv_resp.content.decode("utf-8").strip().splitlines()
    # 4 comment/meta lines + 1 header + 6000 data rows = 6005 lines (blank line stripped or included)
    assert len(lines) >= 6005

    pdf_resp = client.post(
        "/api/v1/reports/export/pdf",
        json={"report_type": "construction_progress", "project_id": "ALL", "max_rows": 6000},
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")
