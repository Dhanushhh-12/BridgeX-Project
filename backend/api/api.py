"""
AI Bridge X – FastAPI Backend Application
Provides root (/), health (/health), system-info (/system-info),
ML duration prediction (/predict), weather forecast (/weather),
computer vision endpoints (/analyze-image, /analyze-progress),
and local Ollama AI chat (/ai/chat).
"""

from datetime import datetime
from http import HTTPStatus
import io
import json
import logging
import os
import re
import sys
import uuid
from pathlib import Path

# Ensure the project root (C:\bridgeX) is importable regardless of launch folder
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# 1. Import FastAPI, exception classes, Pillow, and Pydantic
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

# 2. Reuse existing project config, ML prediction, weather, and local LLM service
from config import CONTRACTORS, DATA_DIR, TARGET, TASK_TYPES
from predict import load_trained_model, predict_duration
from weather import count_rainy_days, get_rainfall_forecast
from backend.db.database import check_database_health, ensure_database_initialized
from backend.services.assistant_service import ask_assistant
from backend.services.auth_service import ensure_env_admin_if_configured
from backend.services.platform_db_service import (
    record_cv_analysis,
    record_ml_prediction,
    record_weather_observation,
)
from backend.api.routes.analytics import router as analytics_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.projects import router as projects_router
from backend.api.routes.reports import router as reports_router
from backend.api.routes.users import router as users_router
from backend.services.llm_service import (
    EmptyChatInputError,
    LLMServiceError,
    LocalLLMModelNotFoundError,
    LocalLLMTimeoutError,
    LocalLLMUnavailableError,
    MAX_CHAT_MESSAGE_LENGTH,
)

# Configure server-side logger (records debug details/tracebacks privately on server)
logger = logging.getLogger("bridgeX.api")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)

# 3. Create the FastAPI application instance with title, description, and version
app = FastAPI(
    title="AI Bridge X API",
    description="Backend API for AI Bridge X – Intelligent Infrastructure Progress & Delay Prediction Platform.",
    version="1.0.0",
)

# Configure explicit CORS origins for the React frontend (never wildcard '*' in auth setups)
_cors_origins_raw = os.getenv(
    "BRIDGEX_CORS_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
)
ALLOWED_CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in _cors_origins_raw.split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Attach defensive security headers and prevent caching of auth endpoints."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if request.url.path.startswith("/api/v1/auth"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

# Initialize SQLite auth/project tables safely at startup
ensure_database_initialized()
ensure_env_admin_if_configured()

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(analytics_router)
app.include_router(reports_router)


def _http_error_label(status_code: int) -> str:
    """Return a readable HTTP error phrase such as 'Bad Request' or 'Not Found'."""
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "API Error"


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return consistent JSON for handled HTTP errors without exposing sensitive internals."""
    error_label = _http_error_label(exc.status_code)
    logger.warning(
        "HTTP %s on %s %s: %s",
        exc.status_code,
        request.method,
        request.url.path,
        exc.detail if not isinstance(exc.detail, list) else "metadata validation error",
    )
    if isinstance(exc.detail, list):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": error_label,
                "message": "Request validation failed.",
                "detail": exc.detail,
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": error_label,
            "message": str(exc.detail),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Keep FastAPI's 422 field details while adding consistent success/error/message keys."""
    safe_errors = json.loads(json.dumps(exc.errors(), default=str))
    logger.warning(
        "Validation error (422) on %s %s (%d error(s))",
        request.method,
        request.url.path,
        len(safe_errors),
    )
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validation Error",
            "message": "One or more input fields failed validation.",
            "detail": safe_errors,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log unexpected server tracebacks privately and return a safe JSON 500 error."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected internal server error occurred.",
        },
    )


# 4. Safely load the trained XGBoost model once at startup (server stays up if missing)
try:
    ml_model = load_trained_model()
    logger.info("Trained ML model loaded successfully.")
except Exception:
    logger.exception("Could not load trained ML model at startup.")
    ml_model = None


# 5. Define Pydantic input schema matching predict.py and config.py
class PredictionRequest(BaseModel):
    """Validated input payload for construction task actual duration prediction."""

    task_type: str = Field(
        ...,
        min_length=1,
        description=f"Construction task type. Allowed: {', '.join(TASK_TYPES)}",
        examples=["Excavation"],
    )
    contractor: str = Field(
        ...,
        min_length=1,
        description=f"Contractor name. Allowed: {', '.join(CONTRACTORS)}",
        examples=["Apex Builders"],
    )
    planned_duration: int = Field(
        ...,
        ge=1,
        le=365,
        description="Planned task duration in days (1 to 365)",
        examples=[9],
    )
    crew_size: int = Field(
        ...,
        ge=1,
        le=500,
        description="Number of assigned workers (1 to 500)",
        examples=[15],
    )
    material_cost: float = Field(
        ...,
        ge=100.0,
        le=10000000.0,
        allow_inf_nan=False,
        description="Estimated material cost in USD (100 to 10,000,000)",
        examples=[59161.84],
    )
    weather_risk: int = Field(
        ...,
        ge=1,
        le=5,
        description="Weather risk level (1 = low, 5 = severe)",
        examples=[2],
    )
    complexity_level: int = Field(
        ...,
        ge=1,
        le=10,
        description="Engineering complexity score (1 to 10)",
        examples=[5],
    )

    @field_validator(
        "planned_duration",
        "crew_size",
        "material_cost",
        "weather_risk",
        "complexity_level",
        mode="before",
    )
    @classmethod
    def reject_booleans_for_numbers(cls, value):
        """Prevent JSON booleans (true/false) from silently converting into 1/0."""
        if isinstance(value, bool):
            raise ValueError("Boolean values (true/false) are not valid numeric inputs.")
        return value

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, value: str) -> str:
        """Strip whitespace and ensure task_type matches config.TASK_TYPES."""
        cleaned = value.strip()
        if cleaned not in TASK_TYPES:
            raise ValueError(f"Unknown task_type '{cleaned}'. Expected one of: {TASK_TYPES}")
        return cleaned

    @field_validator("contractor")
    @classmethod
    def validate_contractor(cls, value: str) -> str:
        """Strip whitespace and ensure contractor matches config.CONTRACTORS."""
        cleaned = value.strip()
        if cleaned not in CONTRACTORS:
            raise ValueError(f"Unknown contractor '{cleaned}'. Expected one of: {CONTRACTORS}")
        return cleaned


# 6. Root endpoint: GET /
@app.get("/")
def read_root():
    """Return a welcome message confirming the API is running."""
    return {
        "message": "Welcome to AI Bridge X API",
        "project": "AI Bridge X",
        "status": "running",
    }


# 7. Health check endpoint: GET /health
@app.get("/health")
def health_check():
    """Return the health status, application name, API version, and safe DB status."""
    db_ok = check_database_health()
    return {
        "status": "healthy" if db_ok else "degraded",
        "application": app.title,
        "version": app.version,
        "database": "connected" if db_ok else "unavailable",
    }


# 8. System information endpoint: GET /system-info
@app.get("/system-info")
def system_info():
    """Return basic, non-sensitive application and backend status details."""
    return {
        "application_name": app.title,
        "version": app.version,
        "backend_status": "running",
    }


# 9. ML prediction endpoint: POST /predict
@app.post("/predict")
def predict_task_duration(request: PredictionRequest):
    """Predict construction task actual_duration (in days) using the trained model."""
    if ml_model is None:
        logger.error("POST /predict requested, but ML model is not loaded.")
        raise HTTPException(
            status_code=503,
            detail="Trained ML prediction model is currently unavailable.",
        )

    try:
        predicted_days = predict_duration(
            model=ml_model,
            task_type=request.task_type,
            contractor=request.contractor,
            planned_duration=request.planned_duration,
            crew_size=request.crew_size,
            material_cost=request.material_cost,
            weather_risk=request.weather_risk,
            complexity_level=request.complexity_level,
        )
    except ValueError as exc:
        logger.warning("ML input encoding error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected ML prediction failure.")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate prediction with the ML model.",
        ) from exc

    record_ml_prediction(
        task_type=request.task_type,
        contractor=request.contractor,
        planned_duration=request.planned_duration,
        crew_size=request.crew_size,
        material_cost=request.material_cost,
        weather_risk=request.weather_risk,
        complexity_level=request.complexity_level,
        predicted_duration_days=predicted_days,
    )

    return {
        "status": "success",
        "target": TARGET,
        "predicted_value": predicted_days,
        "units": "days",
    }


# 10. Weather forecast endpoint: GET /weather
@app.get("/weather")
def get_weather(
    latitude: float = Query(
        ...,
        ge=-90.0,
        le=90.0,
        allow_inf_nan=False,
        description="Site latitude in decimal degrees (-90 to 90)",
    ),
    longitude: float = Query(
        ...,
        ge=-180.0,
        le=180.0,
        allow_inf_nan=False,
        description="Site longitude in decimal degrees (-180 to 180)",
    ),
    days: int = Query(
        default=7,
        ge=1,
        le=16,
        description="Number of forecast days (1 to 16)",
    ),
    threshold_mm: float = Query(
        default=5.0,
        ge=0.0,
        allow_inf_nan=False,
        description="Rainfall threshold in mm to count as a rainy day",
    ),
):
    """Fetch Open-Meteo daily rainfall forecast and rainy day summary for coordinates."""
    try:
        dates, rainfall_amounts = get_rainfall_forecast(
            latitude=latitude,
            longitude=longitude,
            days=days,
        )
        rainy_days = count_rainy_days(rainfall_amounts, threshold_mm=threshold_mm)
    except ValueError as exc:
        logger.warning("Weather parameter error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("Weather upstream service error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Weather service is temporarily unavailable or returned an invalid response.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected weather endpoint failure.")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving weather data.",
        ) from exc

    total_rain = round(sum(rainfall_amounts), 2)
    record_weather_observation(
        latitude=latitude,
        longitude=longitude,
        forecast_days=len(dates),
        threshold_mm=threshold_mm,
        rainy_days_count=rainy_days,
        total_rainfall_mm=total_rain,
    )

    return {
        "status": "success",
        "source": "Open-Meteo",
        "record_kind": "forecast",
        "latitude": latitude,
        "longitude": longitude,
        "forecast_days": len(dates),
        "rain_threshold_mm": threshold_mm,
        "rainy_days_count": rainy_days,
        "total_rainfall_mm": total_rain,
        "units": "mm",
        "daily_forecast": [
            {
                "date": day,
                "rainfall_mm": rain_mm,
                "is_rainy": rain_mm >= threshold_mm,
            }
            for day, rain_mm in zip(dates, rainfall_amounts)
        ],
    }


# 11. Computer Vision upload & segmentation settings and helpers
UPLOAD_DIR = os.path.join(DATA_DIR, "images", "uploads")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB maximum upload size
MAX_IMAGE_PIXELS_TOTAL = 40_000_000  # 40 MP decompression-bomb guard
MAX_ANALYSIS_DIMENSION = 1024        # Matches prepare_images.py for safe CPU inference
ALLOWED_IMAGE_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
}
_segformer_cache: dict = {}


def _get_segformer_bundle() -> dict:
    """Lazily load and cache SegFormer plus existing Step 11 helper functions."""
    if _segformer_cache:
        return _segformer_cache

    try:
        import torch
        from transformers import (
            SegformerForSemanticSegmentation,
            SegformerImageProcessor,
        )
        from analyze_segmentation import build_report_rows
        from compare_images import compute_image_difference, load_and_match_images
        from compare_segmentation import (
            REPORTS_DIR,
            build_difference_overlay,
            compare_masks_and_stats,
            segment_pil_image,
        )
        from progress_report import (
            LIMITATION_NOTE,
            build_report_dataframe,
            save_html_report,
            unique_output_path,
        )
        from segformer_test import MODEL_NAME
        from segment_image import (
            SEGMENTED_DIR,
            build_color_palette,
            mask_to_color_image,
        )

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        processor = SegformerImageProcessor.from_pretrained(MODEL_NAME)
        model = SegformerForSemanticSegmentation.from_pretrained(MODEL_NAME)
        model.to(device)
        model.eval()

        id2label = {int(k): str(v) for k, v in model.config.id2label.items()}
        palette = build_color_palette(len(id2label))

        _segformer_cache.update(
            {
                "model_name": MODEL_NAME,
                "device": device,
                "processor": processor,
                "model": model,
                "id2label": id2label,
                "palette": palette,
                "segmented_dir": SEGMENTED_DIR,
                "reports_dir": REPORTS_DIR,
                "segment_pil_image": segment_pil_image,
                "mask_to_color_image": mask_to_color_image,
                "build_report_rows": build_report_rows,
                "load_and_match_images": load_and_match_images,
                "compute_image_difference": compute_image_difference,
                "compare_masks_and_stats": compare_masks_and_stats,
                "build_difference_overlay": build_difference_overlay,
                "build_report_dataframe": build_report_dataframe,
                "save_html_report": save_html_report,
                "unique_output_path": unique_output_path,
                "limitation_note": LIMITATION_NOTE,
            }
        )
        return _segformer_cache
    except (OSError, RuntimeError, Exception) as exc:
        logger.exception("Failed to load SegFormer computer vision model.")
        raise HTTPException(
            status_code=503,
            detail="Computer vision model could not be loaded right now.",
        ) from exc


def _validate_and_load_uploaded_image(file_bytes: bytes) -> tuple[Image.Image, str, tuple[int, int]]:
    """Verify actual image content (not just filename), size, and allowed formats."""
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Uploaded file exceeds the 10 MB maximum size limit.",
        )

    try:
        with Image.open(io.BytesIO(file_bytes)) as check_img:
            actual_format = (check_img.format or "").upper()
            width, height = check_img.size
            if width * height > MAX_IMAGE_PIXELS_TOTAL:
                raise HTTPException(
                    status_code=400,
                    detail="Image dimensions exceed the maximum allowed pixel limit (40 MP).",
                )
            check_img.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image file. Please upload a valid JPEG or PNG image.",
        ) from exc

    if actual_format not in ALLOWED_IMAGE_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format '{actual_format}'. Only JPEG and PNG are supported.",
        )

    try:
        with Image.open(io.BytesIO(file_bytes)) as raw_img:
            transposed = ImageOps.exif_transpose(raw_img)
            orig_size = transposed.size
            rgb_image = transposed.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not decode the uploaded image pixels safely.",
        ) from exc

    return rgb_image, actual_format, orig_size


async def _read_and_validate_upload(upload_file: UploadFile) -> dict:
    """Read up to MAX_UPLOAD_BYTES + 1 and validate image bytes in memory."""
    file_bytes = await upload_file.read(MAX_UPLOAD_BYTES + 1)
    await upload_file.close()

    rgb_image, actual_format, orig_size = _validate_and_load_uploaded_image(file_bytes)
    safe_original_name = os.path.basename(upload_file.filename) if upload_file.filename else "uploaded_image"

    return {
        "file_bytes": file_bytes,
        "rgb_image": rgb_image,
        "actual_format": actual_format,
        "orig_size": orig_size,
        "original_filename": safe_original_name,
    }


def _save_validated_upload(file_bytes: bytes, actual_format: str, filename_stem: str) -> tuple[str, str]:
    """Save validated upload bytes inside UPLOAD_DIR with a safe generated filename."""
    ext = ALLOWED_IMAGE_FORMATS[actual_format]
    safe_name = f"{filename_stem}{ext}"
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        upload_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(upload_path, "wb") as out_file:
            out_file.write(file_bytes)
    except OSError as exc:
        logger.exception("Failed to write validated upload '%s' to disk.", safe_name)
        raise HTTPException(
            status_code=500,
            detail="Failed to store the uploaded image safely.",
        ) from exc

    return safe_name, upload_path


SAFE_PROJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9 _.-]+$")


class ImageAnalysisMetadata(BaseModel):
    """Pydantic validator for optional project_id and description form fields."""

    project_id: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("project_id", "description", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: str | None) -> str | None:
        """Trim surrounding spaces and normalize empty strings to None."""
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned if cleaned else None

    @field_validator("project_id")
    @classmethod
    def validate_project_id(cls, value: str | None) -> str | None:
        """Allow only safe alphanumeric, space, '.', '_', and '-' characters in project_id."""
        if value is not None and not SAFE_PROJECT_ID_PATTERN.match(value):
            raise ValueError(
                "project_id may only contain letters, numbers, spaces, '.', '_', and '-'."
            )
        return value


def _validate_image_metadata(project_id: str | None, description: str | None) -> ImageAnalysisMetadata:
    """Validate upload form metadata with Pydantic and raise HTTP 422 on error."""
    try:
        return ImageAnalysisMetadata(project_id=project_id, description=description)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=json.loads(exc.json())) from exc


# 12. Computer Vision image upload & segmentation endpoint: POST /analyze-image
@app.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(..., description="Construction site photograph (JPEG or PNG, max 10 MB)"),
    project_id: str | None = Form(default=None, max_length=100, description="Optional project identifier"),
    description: str | None = Form(default=None, max_length=500, description="Optional image description"),
):
    """Upload a construction photograph, save it safely, and run SegFormer segmentation."""
    metadata = _validate_image_metadata(project_id=project_id, description=description)
    upload_data = await _read_and_validate_upload(file)
    orig_w, orig_h = upload_data["orig_size"]

    result_id = f"img_{uuid.uuid4().hex[:12]}"
    safe_upload_name, _ = _save_validated_upload(
        upload_data["file_bytes"],
        upload_data["actual_format"],
        result_id,
    )

    # Resize in memory (up to 1024 px) for safe CPU SegFormer inference while preserving saved upload
    rgb_for_seg = upload_data["rgb_image"].copy()
    rgb_for_seg.thumbnail((MAX_ANALYSIS_DIMENSION, MAX_ANALYSIS_DIMENSION), Image.Resampling.LANCZOS)

    bundle = _get_segformer_bundle()
    try:
        seg_mask = bundle["segment_pil_image"](
            rgb_for_seg,
            bundle["processor"],
            bundle["model"],
            bundle["device"],
        )

        mask_img = bundle["mask_to_color_image"](seg_mask, bundle["palette"])
        segmented_dir = bundle["segmented_dir"]
        os.makedirs(segmented_dir, exist_ok=True)
        safe_mask_name = f"{result_id}_mask.png"
        mask_path = os.path.join(segmented_dir, safe_mask_name)
        mask_img.save(mask_path, format="PNG")

        report_rows = bundle["build_report_rows"](safe_upload_name, seg_mask, bundle["id2label"])
    except HTTPException:
        raise
    except (OSError, RuntimeError, ValueError) as exc:
        logger.exception("Computer vision processing failure on /analyze-image.")
        raise HTTPException(
            status_code=500,
            detail="Failed to process the uploaded image with computer vision.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error on /analyze-image.")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during image analysis.",
        ) from exc

    record_cv_analysis(
        result_id=result_id,
        analysis_kind="single",
        project_code=metadata.project_id,
        model_name=bundle["model_name"],
        image_diff_score_pct=None,
        semantic_change_pct=None,
        detected_classes_count=len(report_rows),
        mask_path=f"data/images/segmented/{safe_mask_name}",
    )

    return {
        "upload_status": "success",
        "result_id": result_id,
        "original_filename": upload_data["original_filename"],
        "project_id": metadata.project_id,
        "description": metadata.description,
        "image_format": upload_data["actual_format"],
        "file_size_bytes": len(upload_data["file_bytes"]),
        "dimensions": {"width": orig_w, "height": orig_h},
        "analyzed_dimensions": {"width": rgb_for_seg.size[0], "height": rgb_for_seg.size[1]},
        "saved_upload_path": f"data/images/uploads/{safe_upload_name}",
        "segmentation_status": "completed",
        "model_used": bundle["model_name"],
        "saved_mask_path": f"data/images/segmented/{safe_mask_name}",
        "detected_classes_count": len(report_rows),
        "detected_classes": report_rows,
        "interpretation_note": bundle["limitation_note"],
    }


# 13. Construction progress analysis endpoint: POST /analyze-progress
@app.post("/analyze-progress")
async def analyze_progress(
    previous_image: UploadFile = File(..., description="Earlier construction site photograph (JPEG or PNG, max 10 MB)"),
    current_image: UploadFile = File(..., description="Later/current construction site photograph (JPEG or PNG, max 10 MB)"),
    project_id: str | None = Form(default=None, max_length=100, description="Optional project identifier"),
    task_description: str | None = Form(default=None, max_length=500, description="Optional construction task description"),
):
    """Compare two construction photographs and generate an AI visual progress report."""
    # Validate metadata and both uploads in memory before saving any file to disk
    metadata = _validate_image_metadata(project_id=project_id, description=task_description)
    prev_data = await _read_and_validate_upload(previous_image)
    curr_data = await _read_and_validate_upload(current_image)

    result_id = f"prog_{uuid.uuid4().hex[:12]}"
    prev_safe_name, prev_path = _save_validated_upload(
        prev_data["file_bytes"],
        prev_data["actual_format"],
        f"{result_id}_previous",
    )
    curr_safe_name, curr_path = _save_validated_upload(
        curr_data["file_bytes"],
        curr_data["actual_format"],
        f"{result_id}_current",
    )

    bundle = _get_segformer_bundle()

    try:
        # 1. Align both photos to shared dimensions & compute pixel-level difference
        img1, img2 = bundle["load_and_match_images"](prev_path, curr_path)
        diff_rgb, image_diff_score, raw_changed_pct = bundle["compute_image_difference"](img1, img2)

        # 2. Run SegFormer semantic segmentation on both aligned photos
        mask1 = bundle["segment_pil_image"](img1, bundle["processor"], bundle["model"], bundle["device"])
        mask2 = bundle["segment_pil_image"](img2, bundle["processor"], bundle["model"], bundle["device"])
        changed_mask, semantic_changed_pct, stats_rows = bundle["compare_masks_and_stats"](
            mask1, mask2, bundle["id2label"]
        )

        # 3. Build and save CSV + HTML visual report inside data/images/reports/
        project_label = metadata.project_id or "AI Bridge X"
        site_label = metadata.description or "Uploaded comparison photos"
        df_report = bundle["build_report_dataframe"](
            project_name=project_label,
            name1=prev_safe_name,
            date1="Uploaded previous photo",
            name2=curr_safe_name,
            date2="Uploaded current photo",
            matched_size=img1.size,
            image_diff_score=image_diff_score,
            raw_changed_pct=raw_changed_pct,
            semantic_changed_pct=semantic_changed_pct,
            stats_rows=stats_rows,
        )

        reports_dir = bundle["reports_dir"]
        csv_path = bundle["unique_output_path"](reports_dir, f"api_progress_{result_id}", ".csv")
        report_tag = os.path.splitext(os.path.basename(csv_path))[0]
        assets_dir = os.path.join(reports_dir, f"{report_tag}_assets")
        os.makedirs(assets_dir, exist_ok=True)

        mask_img1 = bundle["mask_to_color_image"](mask1, bundle["palette"])
        mask_img2 = bundle["mask_to_color_image"](mask2, bundle["palette"])
        diff_img = Image.fromarray(diff_rgb, mode="RGB")
        seg_diff_img = Image.fromarray(bundle["build_difference_overlay"](img2, changed_mask), mode="RGB")

        assets_folder_name = os.path.basename(assets_dir)
        visual_names = {
            "img1": f"{assets_folder_name}/photo1.png",
            "img2": f"{assets_folder_name}/photo2.png",
            "mask1": f"{assets_folder_name}/mask1.png",
            "mask2": f"{assets_folder_name}/mask2.png",
            "diff_img": f"{assets_folder_name}/pixel_diff.png",
            "seg_diff": f"{assets_folder_name}/semantic_diff.png",
        }
        img1.save(os.path.join(assets_dir, "photo1.png"), format="PNG")
        img2.save(os.path.join(assets_dir, "photo2.png"), format="PNG")
        mask_img1.save(os.path.join(assets_dir, "mask1.png"), format="PNG")
        mask_img2.save(os.path.join(assets_dir, "mask2.png"), format="PNG")
        diff_img.save(os.path.join(assets_dir, "pixel_diff.png"), format="PNG")
        seg_diff_img.save(os.path.join(assets_dir, "semantic_diff.png"), format="PNG")

        df_report.to_csv(csv_path, index=False, encoding="utf-8")

        html_path = bundle["unique_output_path"](reports_dir, report_tag, ".html")
        meta = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "project_name": project_label,
            "site_name": site_label,
            "name1": prev_safe_name,
            "date1": "Uploaded previous photo",
            "name2": curr_safe_name,
            "date2": "Uploaded current photo",
            "matched_dims": f"{img1.size[0]}x{img1.size[1]}",
            "image_diff_score": image_diff_score,
            "raw_changed_pct": raw_changed_pct,
            "semantic_changed_pct": semantic_changed_pct,
            "visible_summary": df_report["visible_changes_summary"].iloc[0] if not df_report.empty else "No classes detected",
        }
        bundle["save_html_report"](html_path, os.path.basename(csv_path), df_report, meta, visual_names)
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, RuntimeError) as exc:
        logger.exception("Image comparison/CV error on /analyze-progress.")
        raise HTTPException(
            status_code=400,
            detail="Uploaded images could not be compared or processed cleanly.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error on /analyze-progress.")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during progress analysis.",
        ) from exc

    record_cv_analysis(
        result_id=result_id,
        analysis_kind="comparison",
        project_code=metadata.project_id,
        model_name=bundle["model_name"],
        image_diff_score_pct=image_diff_score,
        semantic_change_pct=semantic_changed_pct,
        detected_classes_count=len(stats_rows),
        csv_report_path=f"data/images/reports/{os.path.basename(csv_path)}",
        html_report_path=f"data/images/reports/{os.path.basename(html_path)}",
    )

    return {
        "analysis_status": "completed",
        "result_id": result_id,
        "project_id": metadata.project_id,
        "task_description": metadata.description,
        "previous_image": {
            "original_filename": prev_data["original_filename"],
            "format": prev_data["actual_format"],
            "file_size_bytes": len(prev_data["file_bytes"]),
            "original_dimensions": {"width": prev_data["orig_size"][0], "height": prev_data["orig_size"][1]},
            "saved_upload_path": f"data/images/uploads/{prev_safe_name}",
        },
        "current_image": {
            "original_filename": curr_data["original_filename"],
            "format": curr_data["actual_format"],
            "file_size_bytes": len(curr_data["file_bytes"]),
            "original_dimensions": {"width": curr_data["orig_size"][0], "height": curr_data["orig_size"][1]},
            "saved_upload_path": f"data/images/uploads/{curr_safe_name}",
        },
        "matched_dimensions": {"width": img1.size[0], "height": img1.size[1]},
        "ai_visual_observations": {
            "segmentation_model": bundle["model_name"],
            "image_difference_score_pct": image_diff_score,
            "raw_changed_pixels_pct": raw_changed_pct,
            "semantic_region_change_pct": semantic_changed_pct,
            "detected_classes_count": len(stats_rows),
            "top_visible_class_shifts": stats_rows[:10],
        },
        "generated_reports": {
            "csv_report_path": f"data/images/reports/{os.path.basename(csv_path)}",
            "html_report_path": f"data/images/reports/{os.path.basename(html_path)}",
            "visual_assets_dir": f"data/images/reports/{assets_folder_name}",
        },
        "engineer_verification": {
            "verified_completion_pct": None,
            "verification_status": "Pending engineer review",
        },
        "limitations": (
            f"{bundle['limitation_note']} "
            "Different camera angles, zoom levels, lighting, or shadows between photos "
            "can significantly increase visual difference scores."
        ),
    }


# 14. Local Ollama AI Chat schemas & endpoint: POST /ai/chat
class AIChatRequest(BaseModel):
    """Validated input schema for asking the local AI Bridge X assistant."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=MAX_CHAT_MESSAGE_LENGTH,
        description=f"Question for the local Ollama AI assistant (1 to {MAX_CHAT_MESSAGE_LENGTH} characters).",
        examples=["Explain the construction delay prediction system."],
    )

    @field_validator("message")
    @classmethod
    def validate_non_empty_message(cls, value: str) -> str:
        """Trim surrounding whitespace and reject blank-only messages."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message cannot be empty or whitespace only.")
        return cleaned


class AIChatResponse(BaseModel):
    """Structured JSON response returned by POST /ai/chat."""

    success: bool
    response: str


@app.post("/ai/chat", response_model=AIChatResponse)
def ai_chat(request: AIChatRequest):
    """Answer a question via the grounded AI Bridge X assistant service (local Ollama)."""
    try:
        result = ask_assistant(request.message)
    except EmptyChatInputError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (LocalLLMUnavailableError, LocalLLMModelNotFoundError, LocalLLMTimeoutError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except LLMServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return AIChatResponse(success=True, response=result["response"])
