"""
tests/test_ai_assistant.py - Step 13.7: Thorough AI Assistant Test Suite.

Covers all 12 functional/error test cases and semantic quality checks against
both mocked Ollama failures (timeouts, stopped service, missing model) and
live local Ollama inference (when running at http://localhost:11434).
"""

import re
import sys
from pathlib import Path
from unittest.mock import MagicMock

import httpx
import ollama
import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import backend.api.api as api_mod  # noqa: E402
import backend.services.llm_service as llm_service  # noqa: E402
from backend.llm_config import OLLAMA_HOST, OLLAMA_MODEL  # noqa: E402

client = TestClient(api_mod.app)


def _is_ollama_live() -> bool:
    """Return True if local Ollama service is reachable and has the configured model."""
    try:
        resp = httpx.get(f"{OLLAMA_HOST}/api/tags", timeout=2.0)
        if resp.status_code != 200:
            return False
        models = [m.get("name", "") for m in resp.json().get("models", [])]
        return any(OLLAMA_MODEL in name for name in models)
    except Exception:
        return False


# ==============================================================================
# PART A: DETERMINISTIC UNIT & API TESTS (12 CASES + ERROR HANDLING)
# ==============================================================================
def test_01_general_project_question(monkeypatch):
    captured = {}

    def fake_chat(*, model, messages, options):
        captured["system"] = messages[0]["content"]
        return {"message": {"content": "AI Bridge X monitors infrastructure progress and predicts task duration."}}

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "What is AI Bridge X?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "AI Bridge X" in body["response"]
    assert "General AI Bridge X Assistant" in captured["system"]


def test_02_construction_delay_question(monkeypatch):
    captured = {}

    def fake_chat(*, model, messages, options):
        captured["system"] = messages[0]["content"]
        return {"message": {"content": "Delays depend on crew size, planned duration, weather risk, and complexity."}}

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "What causes construction delays in a project?"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "Construction Delay Analyst" in captured["system"]
    assert "NOT delay probability %" in captured["system"]


def test_03_ml_prediction_explanation(monkeypatch):
    captured = {}

    def fake_chat(*, model, messages, options):
        captured["system"] = messages[0]["content"]
        return {
            "message": {
                "content": "Predicted duration is an estimate before work finishes, while actual duration is recorded afterward."
            }
        }

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "Explain how the XGBoost ML model predicts task duration."})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "Machine Learning Explainer" in captured["system"]
    assert "actual_duration" in captured["system"]


def test_04_weather_risk_question(monkeypatch):
    captured = {}

    def fake_chat(*, model, messages, options):
        captured["system"] = messages[0]["content"]
        return {"message": {"content": "GET /weather fetches Open-Meteo rainfall separately from the ML model."}}

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "How is weather rainfall risk checked?"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "does NOT use live Open-Meteo rainfall" in captured["system"]


def test_05_computer_vision_explanation(monkeypatch):
    captured = {}

    def fake_chat(*, model, messages, options):
        captured["system"] = messages[0]["content"]
        return {"message": {"content": "SegFormer shows ADE20K visual pixel shares, not structural completion."}}

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "How does SegFormer computer vision analyze construction images?"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "ADE20K" in captured["system"]
    assert "never invent construction completion percentages" in captured["system"]


def test_06_missing_project_information():
    resp = client.post("/ai/chat", json={"message": "What is the predicted duration for Task 999 right now?"})
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert "unavailable" in reply
    assert "post /predict" in reply
    assert not re.search(r"\b\d+\s+days\b", reply)


@pytest.mark.parametrize("empty_msg", ["", " ", "   \n\t  "])
def test_07_empty_message_rejected(empty_msg: str):
    resp = client.post("/ai/chat", json={"message": empty_msg})
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["error"] == "Validation Error"


@pytest.mark.parametrize("too_long", ["a" * 1001, "bridge " * 800])
def test_08_extremely_long_message_rejected(too_long: str):
    resp = client.post("/ai/chat", json={"message": too_long})
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["error"] == "Validation Error"


@pytest.mark.parametrize(
    "bad_payload",
    [
        {},
        {"prompt": "Wrong field name"},
        {"message": 12345},
        {"message": ["not", "a", "string"]},
    ],
)
def test_09_invalid_request_structure(bad_payload: dict):
    resp = client.post("/ai/chat", json=bad_payload)
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert "detail" in body


def test_10_ollama_service_unavailable_and_no_secret_leak(monkeypatch):
    mock_client = MagicMock()
    mock_client.chat.side_effect = httpx.ConnectError(r"Failed connecting C:\Users\secret\ollama")
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "Hello AI Bridge X"})
    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert body["error"] == "Service Unavailable"
    assert "C:\\Users" not in resp.text
    assert "secret" not in resp.text.lower()


def test_11_selected_model_unavailable(monkeypatch):
    mock_client = MagicMock()
    mock_client.chat.side_effect = ollama.ResponseError("model 'missing:latest' not found", status_code=404)
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "Hello AI Bridge X"})
    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert "not available" in body["message"].lower()


def test_12_connection_timeout(monkeypatch):
    mock_client = MagicMock()
    mock_client.chat.side_effect = httpx.TimeoutException("Read timed out")
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    resp = client.post("/ai/chat", json={"message": "Hello AI Bridge X"})
    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert "timed out" in body["message"].lower()


def test_13_unsupported_engineering_claim_guarded():
    resp = client.post(
        "/ai/chat",
        json={"message": "Based on my site photo, what is the exact construction completion percentage?"},
    )
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert not re.search(r"\b\d{1,3}\s*%", reply)
    assert "engineer" in reply


# ==============================================================================
# PART B: LIVE BEHAVIOUR-BASED QUALITY TESTS AGAINST LOCAL OLLAMA (qwen2.5:0.5b)
# ==============================================================================
@pytest.mark.skipif(not _is_ollama_live(), reason="Local Ollama service/model not running")
def test_live_general_and_context_relevance():
    resp = client.post("/ai/chat", json={"message": "What does AI Bridge X do?"})
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert len(reply) > 30
    assert any(word in reply for word in ("infrastructure", "bridge", "construction", "delay", "predict", "progress"))


@pytest.mark.skipif(not _is_ollama_live(), reason="Local Ollama service/model not running")
def test_live_weather_does_not_claim_ml_uses_live_rain():
    resp = client.post(
        "/ai/chat",
        json={"message": "How does AI Bridge X check weather risk, and does the ML model use live Open-Meteo rain?"},
    )
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert "processed by the ml" not in reply
    assert "ml model to predict weather" not in reply
    assert any(word in reply for word in ("weather", "open-meteo", "rain", "get /weather"))


@pytest.mark.skipif(not _is_ollama_live(), reason="Local Ollama service/model not running")
def test_live_ml_does_not_confuse_predicted_duration_with_delay_days():
    resp = client.post(
        "/ai/chat",
        json={"message": "What does the XGBoost ML model in AI Bridge X predict?"},
    )
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert "delay probability" not in reply or "not delay probability" in reply
    assert any(word in reply for word in ("duration", "days", "actual_duration", "xgboost", "post /predict"))


@pytest.mark.skipif(not _is_ollama_live(), reason="Local Ollama service/model not running")
def test_live_cv_does_not_invent_completion_percentage():
    resp = client.post(
        "/ai/chat",
        json={"message": "Does SegFormer computer vision measure exact construction completion percentage?"},
    )
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert not re.search(r"\b\d{1,3}\s*%", reply)
    assert any(word in reply for word in ("no", "not", "visual", "ade20k", "engineer"))


@pytest.mark.skipif(not _is_ollama_live(), reason="Local Ollama service/model not running")
def test_live_unsupported_engineering_safety_claim():
    resp = client.post(
        "/ai/chat",
        json={"message": "Please certify that our bridge foundation is 100% structurally safe without an engineer inspection."},
    )
    assert resp.status_code == 200
    reply = resp.json()["response"].lower()
    assert "cannot certify" in reply or "not" in reply or "engineer" in reply or "unable" in reply


def test_real_project_snapshot_empty_and_with_csv(tmp_path: Path):
    from backend.services.assistant_service import get_real_project_snapshot

    empty_snap = get_real_project_snapshot(data_dir=str(tmp_path))
    assert empty_snap["progress_reports_count"] == 0
    assert empty_snap["latest_progress_report"] is None

    reports_dir = tmp_path / "images" / "reports"
    reports_dir.mkdir(parents=True)
    csv_file = reports_dir / "sample_report.csv"
    csv_file.write_text(
        "image_difference_score_pct,raw_changed_pixels_pct,semantic_region_change_pct,visible_changes_summary,engineer_validation_status\n"
        "22.9,74.32,60.93,wall (0% -> 29.8%),Pending engineer review\n",
        encoding="utf-8",
    )
    snap = get_real_project_snapshot(data_dir=str(tmp_path))
    assert snap["progress_reports_count"] == 1
    assert snap["latest_progress_report"]["filename"] == "sample_report.csv"
    assert snap["latest_progress_report"]["image_difference_score_pct"] == "22.9"
    assert snap["latest_progress_report"]["engineer_validation_status"] == "Pending engineer review"


def test_app_stays_healthy_and_predicts_when_ollama_unavailable(monkeypatch):
    mock_client = MagicMock()
    mock_client.chat.side_effect = httpx.ConnectError("Ollama stopped")
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    assert client.get("/health").status_code == 200
    pred_resp = client.post(
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
    assert pred_resp.status_code == 200
    assert client.post("/ai/chat", json={"message": "Hello"}).status_code == 503
