"""
tests/test_api.py - Step 12.16: Automated backend API test suite for AI Bridge X.

Uses FastAPI's TestClient and pytest fixtures (tmp_path, monkeypatch) so all
tests run cleanly offline without modifying construction_tasks.csv,
models/delay_predictor.pkl, or production image folders.
"""

import io
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image
import pytest
import requests
from fastapi.testclient import TestClient

# Ensure C:\bridgeX root is importable regardless of how pytest is invoked
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import backend.api.api as api_mod  # noqa: E402


client = TestClient(api_mod.app)


def _make_jpeg_bytes(width: int = 64, height: int = 48, color: tuple[int, int, int] = (120, 140, 160)) -> bytes:
    """Create valid in-memory JPEG image bytes for upload tests."""
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=color).save(buf, format="JPEG")
    return buf.getvalue()


def _install_fake_cv_bundle(monkeypatch, tmp_path: Path) -> tuple[Path, Path, Path]:
    """
    Redirect upload/output folders to tmp_path and supply a fast deterministic
    CV bundle so endpoint validation, file saving, and report responses are
    tested without needing live Hugging Face downloads or overwriting real data.
    """
    uploads_dir = tmp_path / "uploads"
    segmented_dir = tmp_path / "segmented"
    reports_dir = tmp_path / "reports"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    segmented_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(api_mod, "UPLOAD_DIR", str(uploads_dir))

    id2label = {0: "wall", 1: "building", 2: "sky"}
    palette = np.array([[200, 80, 80], [80, 180, 80], [80, 120, 220]], dtype=np.uint8)

    def fake_segment(image: Image.Image, processor, model, device) -> np.ndarray:
        w, h = image.size
        mask = np.zeros((h, w), dtype=np.int64)
        mask[h // 2 :, :] = 1
        return mask

    def fake_mask_to_color(class_mask: np.ndarray, pal: np.ndarray) -> Image.Image:
        return Image.fromarray(pal[class_mask], mode="RGB")

    def fake_build_report_rows(image_filename: str, class_mask: np.ndarray, labels: dict) -> list[dict]:
        total = int(class_mask.size)
        unique_ids, counts = np.unique(class_mask, return_counts=True)
        return [
            {
                "image_filename": image_filename,
                "predicted_class_id": int(cid),
                "predicted_class_name": labels[int(cid)],
                "pixel_count": int(cnt),
                "percentage_of_image_pixels": round((int(cnt) / total) * 100.0, 2),
            }
            for cid, cnt in zip(unique_ids, counts)
        ]

    def fake_load_and_match(path1: str, path2: str) -> tuple[Image.Image, Image.Image]:
        with Image.open(path1) as f1:
            img1 = f1.convert("RGB")
        with Image.open(path2) as f2:
            img2 = f2.convert("RGB").resize(img1.size)
        return img1, img2

    def fake_compute_diff(img1: Image.Image, img2: Image.Image):
        arr1 = np.asarray(img1, dtype=np.int16)
        arr2 = np.asarray(img2, dtype=np.int16)
        diff = np.abs(arr1 - arr2).astype(np.uint8)
        score = round((float(diff.mean()) / 255.0) * 100.0, 2)
        changed = round(float((diff.mean(axis=2) > 25).mean() * 100.0), 2)
        return diff, score, changed

    def fake_compare_masks(mask1: np.ndarray, mask2: np.ndarray, labels: dict):
        changed_mask = mask1 != mask2
        changed_pct = round(float(changed_mask.mean() * 100.0), 2)
        rows = [
            {
                "class_id": 1,
                "class_name": "building",
                "pixels_1": int((mask1 == 1).sum()),
                "pct_1": 50.0,
                "pixels_2": int((mask2 == 1).sum()),
                "pct_2": 50.0,
                "diff_pct": 0.0,
            }
        ]
        return changed_mask, changed_pct, rows

    def fake_diff_overlay(img2: Image.Image, changed_mask: np.ndarray) -> np.ndarray:
        return np.asarray(img2, dtype=np.uint8)

    class _FakeDF:
        empty = False

        def __init__(self, rows):
            self._rows = rows

        def __getitem__(self, key):
            class _Series:
                iloc = ["building (50.0% -> 50.0%)"]
            return _Series()

        def to_csv(self, path: str, index: bool = False, encoding: str = "utf-8"):
            with open(path, "w", encoding=encoding) as f:
                f.write("predicted_class_name,pct_1,pct_2\nbuilding,50.0,50.0\n")

    def fake_build_df(**kwargs):
        return _FakeDF(kwargs["stats_rows"])

    def fake_unique_path(directory: str, base_name: str, ext: str) -> str:
        os.makedirs(directory, exist_ok=True)
        return os.path.join(directory, f"{base_name}{ext}")

    def fake_save_html(html_path: str, csv_filename: str, df_report, meta: dict, visual_files: dict):
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(f"<html><body>Report for {csv_filename}</body></html>")

    fake_bundle = {
        "model_name": "nvidia/segformer-b0-finetuned-ade-512-512",
        "device": "cpu",
        "processor": object(),
        "model": object(),
        "id2label": id2label,
        "palette": palette,
        "segmented_dir": str(segmented_dir),
        "reports_dir": str(reports_dir),
        "segment_pil_image": fake_segment,
        "mask_to_color_image": fake_mask_to_color,
        "build_report_rows": fake_build_report_rows,
        "load_and_match_images": fake_load_and_match,
        "compute_image_difference": fake_compute_diff,
        "compare_masks_and_stats": fake_compare_masks,
        "build_difference_overlay": fake_diff_overlay,
        "build_report_dataframe": fake_build_df,
        "save_html_report": fake_save_html,
        "unique_output_path": fake_unique_path,
        "limitation_note": "AI observation only: test limitation note.",
    }
    monkeypatch.setattr(api_mod, "_get_segformer_bundle", lambda: fake_bundle)
    return uploads_dir, segmented_dir, reports_dir


# ==============================================================================
# 1. HEALTH & SYSTEM ENDPOINTS
# ==============================================================================
def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "AI Bridge X"
    assert data["status"] == "running"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["application"] == "AI Bridge X API"
    assert data["version"] == "1.0.0"


def test_unknown_route_returns_consistent_404():
    response = client.get("/nonexistent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Not Found"


# ==============================================================================
# 2. MACHINE LEARNING ENDPOINT (POST /predict)
# ==============================================================================
def test_predict_valid_input():
    payload = {
        "task_type": "Excavation",
        "contractor": "Apex Builders",
        "planned_duration": 9,
        "crew_size": 15,
        "material_cost": 59161.84,
        "weather_risk": 2,
        "complexity_level": 5,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target"] == "actual_duration"
    assert data["units"] == "days"
    assert isinstance(data["predicted_value"], (int, float))
    assert data["predicted_value"] > 0


def test_predict_missing_required_field():
    payload = {
        "task_type": "Excavation",
        "contractor": "Apex Builders",
        "planned_duration": 9,
        # crew_size omitted intentionally
        "material_cost": 59161.84,
        "weather_risk": 2,
        "complexity_level": 5,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Validation Error"


def test_predict_invalid_numerical_values():
    payload = {
        "task_type": "Excavation",
        "contractor": "Apex Builders",
        "planned_duration": -5,
        "crew_size": 0,
        "material_cost": -100.0,
        "weather_risk": 9,
        "complexity_level": 15,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert len(data["detail"]) >= 4


def test_predict_missing_model_returns_503(monkeypatch):
    monkeypatch.setattr(api_mod, "ml_model", None)
    payload = {
        "task_type": "Excavation",
        "contractor": "Apex Builders",
        "planned_duration": 9,
        "crew_size": 15,
        "material_cost": 59161.84,
        "weather_risk": 2,
        "complexity_level": 5,
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Service Unavailable"


# ==============================================================================
# 3. WEATHER ENDPOINT (GET /weather)
# ==============================================================================
def test_weather_valid_coordinates_mocked():
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = {
        "daily": {
            "time": ["2026-11-27", "2026-11-28", "2026-11-29"],
            "precipitation_sum": [1.0, 7.5, 0.0],
        }
    }
    with patch("weather.requests.get", return_value=mock_resp):
        response = client.get("/weather?latitude=17.385&longitude=78.4867&days=3&threshold_mm=5")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["source"] == "Open-Meteo"
    assert data["forecast_days"] == 3
    assert data["rainy_days_count"] == 1
    assert data["total_rainfall_mm"] == 8.5


@pytest.mark.parametrize(
    "query",
    [
        "latitude=200&longitude=78.4867&days=7",   # invalid latitude
        "latitude=17.385&longitude=-250&days=7",   # invalid longitude
        "latitude=17.385&longitude=78.4867&days=30",  # invalid forecast days > 16
        "latitude=17.385&longitude=78.4867&days=0",   # invalid forecast days < 1
    ],
)
def test_weather_invalid_parameters(query: str):
    response = client.get(f"/weather?{query}")
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Validation Error"


def test_weather_simulated_service_failure():
    with patch("weather.requests.get", side_effect=requests.exceptions.Timeout("timed out")):
        response = client.get("/weather?latitude=17.385&longitude=78.4867&days=7")

    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Service Unavailable"


# ==============================================================================
# 4. COMPUTER VISION ENDPOINTS (POST /analyze-image & POST /analyze-progress)
# ==============================================================================
def test_analyze_image_valid(monkeypatch, tmp_path: Path):
    uploads_dir, segmented_dir, _ = _install_fake_cv_bundle(monkeypatch, tmp_path)
    img_bytes = _make_jpeg_bytes(64, 48)

    response = client.post(
        "/analyze-image",
        files={"file": ("site_photo.jpg", img_bytes, "image/jpeg")},
        data={"project_id": "Bridge-X 01", "description": "North abutment"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["upload_status"] == "success"
    assert data["image_format"] == "JPEG"
    assert data["dimensions"] == {"width": 64, "height": 48}
    assert data["segmentation_status"] == "completed"
    assert data["detected_classes_count"] == 2
    assert len(list(uploads_dir.iterdir())) == 1
    assert len(list(segmented_dir.iterdir())) == 1


def test_analyze_image_invalid_file(monkeypatch, tmp_path: Path):
    uploads_dir, _, _ = _install_fake_cv_bundle(monkeypatch, tmp_path)
    response = client.post(
        "/analyze-image",
        files={"file": ("not_an_image.jpg", b"not real image bytes", "image/jpeg")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Bad Request"
    assert len(list(uploads_dir.iterdir())) == 0


def test_analyze_image_oversized_file(monkeypatch, tmp_path: Path):
    uploads_dir, _, _ = _install_fake_cv_bundle(monkeypatch, tmp_path)
    oversized = b"x" * (api_mod.MAX_UPLOAD_BYTES + 1)
    response = client.post(
        "/analyze-image",
        files={"file": ("huge.jpg", oversized, "image/jpeg")},
    )
    assert response.status_code == 413
    data = response.json()
    assert data["success"] is False
    assert len(list(uploads_dir.iterdir())) == 0


def test_analyze_progress_valid_pair(monkeypatch, tmp_path: Path):
    uploads_dir, _, reports_dir = _install_fake_cv_bundle(monkeypatch, tmp_path)
    prev_bytes = _make_jpeg_bytes(64, 48, color=(50, 50, 50))
    curr_bytes = _make_jpeg_bytes(64, 48, color=(180, 180, 180))

    response = client.post(
        "/analyze-progress",
        files={
            "previous_image": ("day1.jpg", prev_bytes, "image/jpeg"),
            "current_image": ("day2.jpg", curr_bytes, "image/jpeg"),
        },
        data={"project_id": "Bridge-X", "task_description": "Pier comparison"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["analysis_status"] == "completed"
    assert data["engineer_verification"]["verified_completion_pct"] is None
    assert data["engineer_verification"]["verification_status"] == "Pending engineer review"
    assert len(list(uploads_dir.iterdir())) == 2
    assert any(p.suffix == ".csv" for p in reports_dir.iterdir())
    assert any(p.suffix == ".html" for p in reports_dir.iterdir())


def test_analyze_progress_missing_image(monkeypatch, tmp_path: Path):
    _install_fake_cv_bundle(monkeypatch, tmp_path)
    prev_bytes = _make_jpeg_bytes(64, 48)
    response = client.post(
        "/analyze-progress",
        files={"previous_image": ("day1.jpg", prev_bytes, "image/jpeg")},
    )
    assert response.status_code == 422
    assert response.json()["success"] is False


def test_analyze_progress_corrupted_image(monkeypatch, tmp_path: Path):
    uploads_dir, _, _ = _install_fake_cv_bundle(monkeypatch, tmp_path)
    prev_bytes = _make_jpeg_bytes(64, 48)
    response = client.post(
        "/analyze-progress",
        files={
            "previous_image": ("day1.jpg", prev_bytes, "image/jpeg"),
            "current_image": ("day2_corrupt.jpg", b"corrupted bytes", "image/jpeg"),
        },
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    # Neither file should be saved when validation fails on current_image
    assert len(list(uploads_dir.iterdir())) == 0


# ==============================================================================
# 5. UNHANDLED ERROR SAFETY (NO SECRETS OR PATH LEAKS)
# ==============================================================================
def test_unexpected_error_hides_internal_details(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError(r"C:\private\secret_token=XYZ123")

    monkeypatch.setattr(api_mod, "predict_duration", boom)
    safe_client = TestClient(api_mod.app, raise_server_exceptions=False)
    payload = {
        "task_type": "Excavation",
        "contractor": "Apex Builders",
        "planned_duration": 9,
        "crew_size": 15,
        "material_cost": 59161.84,
        "weather_risk": 2,
        "complexity_level": 5,
    }
    response = safe_client.post("/predict", json=payload)
    assert response.status_code == 500
    body_text = response.text
    assert "secret_token" not in body_text
    assert r"C:\private" not in body_text
    assert response.json()["success"] is False


# ==============================================================================
# 6. LOCAL OLLAMA AI CHAT ENDPOINT (POST /ai/chat)
# ==============================================================================
def test_ai_chat_normal_question(monkeypatch):
    import backend.services.llm_service as llm_service

    mock_client = MagicMock()
    mock_client.chat.return_value = {
        "message": {"content": "AI Bridge X predicts task duration in days using XGBoost."}
    }
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post(
        "/ai/chat",
        json={"message": "Explain the construction delay prediction system."},
    )
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "success": True,
        "response": "AI Bridge X predicts task duration in days using XGBoost.",
    }
    mock_client.chat.assert_called_once()


@pytest.mark.parametrize("bad_message", ["", "   ", "\n\t  "])
def test_ai_chat_empty_message_rejected(bad_message: str):
    response = client.post("/ai/chat", json={"message": bad_message})
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Validation Error"


def test_ai_chat_invalid_request_missing_or_too_long():
    resp_missing = client.post("/ai/chat", json={})
    assert resp_missing.status_code == 422
    assert resp_missing.json()["success"] is False

    resp_too_long = client.post("/ai/chat", json={"message": "a" * 1001})
    assert resp_too_long.status_code == 422
    assert resp_too_long.json()["success"] is False


def test_ai_chat_ollama_service_unavailable(monkeypatch):
    import httpx
    import backend.services.llm_service as llm_service

    mock_client = MagicMock()
    mock_client.chat.side_effect = httpx.ConnectError("Connection refused")
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post("/ai/chat", json={"message": "Hello"})
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert data["error"] == "Service Unavailable"


def test_ai_chat_model_unavailable(monkeypatch):
    import ollama
    import backend.services.llm_service as llm_service

    mock_client = MagicMock()
    mock_client.chat.side_effect = ollama.ResponseError("model 'missing:latest' not found", status_code=404)
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post("/ai/chat", json={"message": "Hello"})
    assert response.status_code == 503
    data = response.json()
    assert data["success"] is False
    assert "not available" in data["message"]


def test_ai_chat_blocks_non_localhost_host(monkeypatch):
    import backend.services.llm_service as llm_service

    monkeypatch.setattr(llm_service, "OLLAMA_HOST", "https://api.openai.com")
    response = client.post("/ai/chat", json={"message": "Hello"})
    assert response.status_code == 503
    assert response.json()["success"] is False
    assert "localhost only" in response.json()["message"]


# ==============================================================================
# 7. GROUNDED AI ASSISTANT SERVICE (Step 13.5)
# ==============================================================================
@pytest.mark.parametrize(
    ("question", "expected_category"),
    [
        ("What does AI Bridge X do?", "general_project"),
        ("Why do construction delays happen on bridge schedules?", "construction_delay"),
        ("How does the XGBoost ML prediction model calculate actual_duration?", "ml_prediction"),
        ("How can rainfall forecast risk affect concrete work?", "weather_risk"),
        ("What does SegFormer computer vision segmentation show?", "computer_vision"),
        ("How does progress monitoring compare two site photos?", "progress_monitoring"),
    ],
)
def test_assistant_question_classification_and_grounding(question: str, expected_category: str):
    from backend.prompts.assistant_prompts import PROMPT_SAFETY_RULES
    from backend.services.assistant_service import build_assistant_prompt, classify_question

    detected = classify_question(question)
    assert detected == expected_category
    prompt = build_assistant_prompt(detected)
    assert PROMPT_SAFETY_RULES in prompt
    assert "qualified civil engineer" in prompt
    assert "AI Bridge X" in prompt


def test_specialized_prompts_cover_all_six_categories():
    from backend.prompts.assistant_prompts import ALL_PROMPT_CATEGORIES, build_specialized_prompt

    assert len(ALL_PROMPT_CATEGORIES) == 6
    prompts = [build_specialized_prompt(cat, model_available=True) for cat in ALL_PROMPT_CATEGORIES]
    assert "POST /predict" in prompts[0]
    assert "actual_duration" in prompts[1]
    assert "predicted duration" in prompts[2]
    assert "Open-Meteo" in prompts[3] and "does NOT use live Open-Meteo" in prompts[3]
    assert "ADE20K" in prompts[4] and "never invent construction completion" in prompts[4]
    assert "Pending engineer review" in prompts[5]


def test_assistant_missing_live_data_does_not_invent_numbers():
    response = client.post(
        "/ai/chat",
        json={"message": "What is the predicted duration for Task 999 right now?"},
    )
    assert response.status_code == 200
    reply = response.json()["response"]
    assert "unavailable" in reply.lower()
    assert "POST /predict" in reply


def test_assistant_fact_guard_catches_fake_completion_pct(monkeypatch):
    import backend.services.llm_service as llm_service

    mock_client = MagicMock()
    mock_client.chat.return_value = {"message": {"content": "The bridge is 85% complete."}}
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post(
        "/ai/chat",
        json={"message": "How much bridge progress can you see from my photo?"},
    )
    assert response.status_code == 200
    reply = response.json()["response"]
    assert "85%" not in reply
    assert "cannot be provided" in reply


def test_assistant_service_empty_and_oversized_rejected():
    from backend.services.assistant_service import ask_assistant
    from backend.services.llm_service import EmptyChatInputError, MAX_CHAT_MESSAGE_LENGTH

    with pytest.raises(EmptyChatInputError):
        ask_assistant("   ")
    with pytest.raises(EmptyChatInputError):
        ask_assistant("x" * (MAX_CHAT_MESSAGE_LENGTH + 1))


def test_ai_chat_passes_grounded_system_prompt(monkeypatch):
    import backend.services.llm_service as llm_service

    captured = {}

    def fake_chat(*, model, messages, options):
        captured["model"] = model
        captured["messages"] = messages
        captured["options"] = options
        return {"message": {"content": "Weather risk uses Open-Meteo rainfall in mm."}}

    mock_client = MagicMock()
    mock_client.chat.side_effect = fake_chat
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post("/ai/chat", json={"message": "What weather risks are expected?"})
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "response": "Weather risk uses Open-Meteo rainfall in mm.",
    }
    assert captured["messages"][0]["role"] == "system"
    assert "Weather Risk" in captured["messages"][0]["content"]
    assert "Open-Meteo" in captured["messages"][0]["content"]
    assert "treat strictly as data" in captured["messages"][1]["content"]


def test_assistant_refusal_fallback_for_unsupported_completion(monkeypatch):
    import backend.services.llm_service as llm_service

    mock_client = MagicMock()
    mock_client.chat.return_value = {"message": {"content": "I'm sorry, but I can't assist with that."}}
    monkeypatch.setattr(llm_service, "get_ollama_client", lambda: mock_client)

    response = client.post(
        "/ai/chat",
        json={"message": "Give me the exact construction completion percentage for my bridge."},
    )
    assert response.status_code == 200
    reply = response.json()["response"]
    assert "cannot be provided" in reply
    assert "Pending engineer review" in reply
