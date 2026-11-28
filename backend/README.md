# AI Bridge X – Backend API

FastAPI backend for **AI Bridge X – Intelligent Infrastructure Progress & Delay Prediction Platform**.

## Folder Structure

- `backend/` – Main backend package
  - `__init__.py` – Marks `backend` as a Python package
  - `README.md` – Backend overview and run instructions
  - `llm_config.py` – Local Ollama configuration (`http://localhost:11434`, `qwen2.5:0.5b`, timeout)
  - `api/` – API application sub-package
    - `__init__.py` – Marks `backend.api` as a Python package
    - `api.py` – Unified FastAPI application connecting ML, Weather, CV, and Local AI Assistant
  - `services/` – Service modules (`llm_service.py`, `assistant_service.py`)
  - `prompts/` – Specialized project-grounded prompts (`assistant_prompts.py`)

## How to Run the Application

1. Start the local **Ollama** service (`http://localhost:11434`) with `qwen2.5:0.5b`.
2. From `C:\bridgeX`, run:

```powershell
python -m uvicorn backend.api.api:app --reload
```

Interactive documentation (Swagger UI): `http://127.0.0.1:8000/docs`

## Available Endpoints

- `GET /` – API welcome and running status
- `GET /health` – Application health status and API version
- `GET /system-info` – Basic non-sensitive backend details
- `POST /predict` – Predicts task `actual_duration` (in days) via `predict.py` and `models/delay_predictor.pkl`
- `GET /weather` – Fetches Open-Meteo daily rainfall forecasts (`mm`) and rainy day counts via `weather.py`
- `POST /analyze-image` – Validates JPEG/PNG uploads and runs SegFormer segmentation (`ADE20K`)
- `POST /analyze-progress` – Compares two uploaded site photos and saves CSV + HTML visual reports
- `POST /ai/chat` – Grounded local Ollama assistant answering project, delay, ML, weather, CV, and progress questions
