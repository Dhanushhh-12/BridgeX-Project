# AI Bridge X – Backend API

This folder contains the FastAPI backend for **AI Bridge X – Intelligent Infrastructure Progress & Delay Prediction Platform**.

## Folder Structure

- `backend/` – Main backend package
  - `__init__.py` – Marks `backend` as a Python package
  - `README.md` – Documentation for the backend module
  - `api/` – Sub-package that will hold API route/endpoint files
    - `__init__.py` – Marks `backend.api` as a Python package

## Connected Existing Modules (Project Root)

The backend will import and use the existing AI Bridge X modules without duplicating or moving them:
- `config.py` – Shared project configuration, feature names, and category encoding
- `predict.py` – Machine learning delay prediction (`models/delay_predictor.pkl`)
- `weather.py` – Rainfall forecast integration (Open-Meteo API)
- `progress_report.py` & Computer Vision scripts (`segment_image.py`, `analyze_segmentation.py`, `compare_images.py`, `compare_segmentation.py`) – Construction image segmentation and progress analysis
