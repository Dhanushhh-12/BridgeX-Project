"""
backend/services/assistant_service.py - Step 13.5 & 13.6: Grounded AI Assistant Service.

Detects question categories, loads specialized safety-enforced prompts from
backend/prompts/assistant_prompts.py, treats user input strictly as data,
and calls the local Ollama service via backend/services/llm_service.py.
"""

import csv
import logging
import os
import re

from backend.prompts.assistant_prompts import (
    CATEGORY_CV,
    CATEGORY_DELAY,
    CATEGORY_GENERAL,
    CATEGORY_ML,
    CATEGORY_PROGRESS,
    CATEGORY_WEATHER,
    REFUSAL_FALLBACKS,
    build_specialized_prompt,
)
from backend.services.llm_service import (
    EmptyChatInputError,
    MAX_CHAT_MESSAGE_LENGTH,
    generate_chat_response,
)
from config import DATA_DIR, DATASET_PATH, MODEL_PATH

logger = logging.getLogger("bridgeX.assistant_service")

CATEGORY_KEYWORDS = {
    CATEGORY_PROGRESS: (
        "progress", "compare", "comparison", "before", "after",
        "image difference", "pixel difference", "visual difference",
        "weekly report", "completion", "analyze-progress", "html report", "complete",
    ),
    CATEGORY_CV: (
        "vision", "segformer", "segment", "segmentation", "mask", "photo",
        "photograph", "image", "picture", "ade20k", "analyze-image",
    ),
    CATEGORY_WEATHER: (
        "weather", "rain", "rainfall", "forecast", "open-meteo", "mm",
        "storm", "climate", "latitude", "longitude",
    ),
    CATEGORY_ML: (
        "ml", "machine learning", "xgboost", "model", "feature", "shap",
        "r2", "mae", "actual_duration", "predict", "prediction", "train",
    ),
    CATEGORY_DELAY: (
        "delay", "late", "overdue", "schedule", "duration", "behind",
        "crew", "complexity", "material cost",
    ),
}


def classify_question(question: str) -> str:
    """Identify the best matching AI Bridge X category for a user's question."""
    lowered = (question or "").strip().lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in lowered for keyword in keywords):
            return category
    return CATEGORY_GENERAL


def get_real_project_snapshot(data_dir: str = DATA_DIR) -> dict:
    """
    Safely read real, non-sensitive project artifact status from disk without
    modifying or retraining any model, dataset, weather, or CV logic.
    """
    images_dir = os.path.join(data_dir, "images")
    reports_dir = os.path.join(images_dir, "reports")
    segmented_dir = os.path.join(images_dir, "segmented")

    segmented_count = (
        len([f for f in os.listdir(segmented_dir) if f.lower().endswith(".png")])
        if os.path.isdir(segmented_dir)
        else 0
    )

    latest_report = None
    report_files = []
    if os.path.isdir(reports_dir):
        report_files = [
            os.path.join(reports_dir, f)
            for f in os.listdir(reports_dir)
            if f.lower().endswith(".csv")
        ]
    if report_files:
        newest_csv = max(report_files, key=os.path.getmtime)
        try:
            with open(newest_csv, mode="r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                first_row = next(reader, None)
            if first_row:
                latest_report = {
                    "filename": os.path.basename(newest_csv),
                    "image_difference_score_pct": first_row.get("image_difference_score_pct"),
                    "raw_changed_pixels_pct": first_row.get("raw_changed_pixels_pct"),
                    "semantic_region_change_pct": first_row.get("semantic_region_change_pct"),
                    "visible_changes_summary": first_row.get("visible_changes_summary"),
                    "engineer_validation_status": first_row.get("engineer_validation_status", "Pending engineer review"),
                }
        except OSError:
            latest_report = None

    return {
        "model_available": os.path.exists(MODEL_PATH),
        "dataset_available": os.path.exists(DATASET_PATH),
        "segmented_masks_count": segmented_count,
        "progress_reports_count": len(report_files),
        "latest_progress_report": latest_report,
    }


def build_assistant_prompt(category: str) -> str:
    """Build the specialized prompt for a category using live model and project facts."""
    snapshot = get_real_project_snapshot()
    base_prompt = build_specialized_prompt(
        category=category,
        model_available=snapshot["model_available"],
    )

    if category in (CATEGORY_GENERAL, CATEGORY_CV, CATEGORY_PROGRESS):
        latest = snapshot["latest_progress_report"]
        if latest:
            snapshot_text = (
                f"\nLive Local Project Snapshot (verified files on disk):\n"
                f"- Segmented masks saved: {snapshot['segmented_masks_count']}, Progress CSV reports: {snapshot['progress_reports_count']}\n"
                f"- Latest saved report ({latest['filename']}): image diff {latest['image_difference_score_pct']}%, "
                f"raw changed pixels {latest['raw_changed_pixels_pct']}%, semantic change {latest['semantic_region_change_pct']}%, "
                f"top shifts [{latest['visible_changes_summary']}], validation status: {latest['engineer_validation_status']}."
            )
        else:
            snapshot_text = (
                f"\nLive Local Project Snapshot (verified files on disk):\n"
                f"- Segmented masks saved: {snapshot['segmented_masks_count']}, Progress CSV reports: 0 (none generated yet)."
            )
        return f"{base_prompt}{snapshot_text}"

    return base_prompt


LIVE_DATA_REQUEST_PATTERNS = (
    re.compile(r"\btask\s*#?\s*\d+\b", re.IGNORECASE),
    re.compile(r"\b(right now|today|tomorrow|exact\s+.*completion\s+percentage)\b", re.IGNORECASE),
)

UNSUPPORTED_SAFETY_CLAIM_PATTERN = re.compile(
    r"\b(certify|guarantee|structurally safe|structural integrity|skip.*inspection|without.*inspection|public traffic)\b",
    re.IGNORECASE,
)

SAFETY_CERTIFICATION_REFUSAL = (
    "AI Bridge X cannot certify structural safety or replace an on-site engineering inspection. "
    "Its ML model only estimates construction task duration in days, and its computer vision model "
    "shows general visual scene labels—neither verifies structural integrity. All safety and structural "
    "decisions must be inspected and approved by a qualified civil or structural engineer."
)


def _needs_unavailable_data_response(question: str, category: str) -> bool:
    """Detect live task/forecast/completion lookups that chat cannot answer without running endpoints."""
    if category in (CATEGORY_ML, CATEGORY_DELAY, CATEGORY_WEATHER, CATEGORY_PROGRESS):
        return any(pattern.search(question) for pattern in LIVE_DATA_REQUEST_PATTERNS)
    return False


def _violates_fact_guard(category: str, reply_text: str) -> bool:
    """Catch common 0.5B hallucinations that contradict verified AI Bridge X architecture."""
    lowered = reply_text.lower()
    if "foundation safety" in lowered or "structural integrity" in lowered and "cannot" not in lowered:
        return True
    if category == CATEGORY_WEATHER and (
        "processed by the ml" in lowered
        or "ml model to predict weather" in lowered
        or "ml model uses open-meteo" in lowered
    ):
        return True
    if category == CATEGORY_ML and "time it takes for the model" in lowered:
        return True
    if category == CATEGORY_PROGRESS and re.search(
        r"\b\d{1,3}(?:\.\d+)?\s*%\s*(?:complete|completed|completion|progress|done)\b",
        lowered,
    ):
        return True
    return False


def _is_generic_refusal(reply_text: str) -> bool:
    """Detect when a tiny local model outputs a blunt refusal instead of helpful guidance."""
    lowered = reply_text.strip().lower()
    return (
        len(lowered) < 120
        and any(phrase in lowered for phrase in ("i'm sorry, but i can't", "i cannot assist", "can't assist with that"))
    )


def ask_assistant(message: str) -> dict:
    """
    Validate user question, select a specialized prompt, frame user text
    safely as data, and return a grounded response from local Ollama.
    """
    cleaned = (message or "").strip()
    if not cleaned:
        raise EmptyChatInputError("Message cannot be empty.")
    if len(cleaned) > MAX_CHAT_MESSAGE_LENGTH:
        raise EmptyChatInputError(
            f"Message exceeds the {MAX_CHAT_MESSAGE_LENGTH}-character limit."
        )

    if UNSUPPORTED_SAFETY_CLAIM_PATTERN.search(cleaned):
        logger.info("Blocked unsupported structural safety certification request cleanly.")
        return {
            "category": classify_question(cleaned),
            "response": SAFETY_CERTIFICATION_REFUSAL,
        }

    category = classify_question(cleaned)
    if _needs_unavailable_data_response(cleaned, category) and category in REFUSAL_FALLBACKS:
        logger.info("Returned missing-data guidance directly for live lookup (%s).", category)
        return {
            "category": category,
            "response": REFUSAL_FALLBACKS[category],
        }

    system_prompt = build_assistant_prompt(category)
    logger.info("Classified assistant question under category '%s'.", category)

    reply_text = generate_chat_response(
        message=cleaned,
        system_prompt=system_prompt,
    )
    if _violates_fact_guard(category, reply_text):
        logger.info("Corrected 0.5B factual misstatement (%s).", category)
        if category == CATEGORY_ML:
            reply_text = (
                "Predicted duration is the XGBoost model's advance estimate in days (via POST /predict) "
                "before construction finishes, whereas actual duration is the real number of days recorded "
                "after the construction task completes. Always verify schedule estimates with a qualified civil engineer."
            )
        elif category in REFUSAL_FALLBACKS:
            reply_text = REFUSAL_FALLBACKS[category]
    elif _is_generic_refusal(reply_text) and category in REFUSAL_FALLBACKS:
        logger.info("Replaced generic 0.5B refusal with grounded guidance (%s).", category)
        reply_text = REFUSAL_FALLBACKS[category]

    return {
        "category": category,
        "response": reply_text,
    }
