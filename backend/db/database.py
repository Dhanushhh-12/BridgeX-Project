"""
backend/db/database.py - Step 14.15: Lightweight SQLite persistence and
versioned idempotent schema migrations for users, token revocation, and projects.

Uses Python's built-in sqlite3 module with zero external DB server dependencies.
Existing CSV datasets, ML models, and CV folders are never altered or deleted.
"""

from contextlib import contextmanager
from datetime import datetime, timezone
import os
import sqlite3
from typing import Iterator

from config import DATA_DIR

DEFAULT_DB_PATH = os.path.join(DATA_DIR, "bridgex.db")

SEEDED_REFERENCE_PROJECTS = [
    (
        "BX-DEMO-001",
        "Musi River Arch Span (Demo)",
        "Arch Bridge",
        "Hyderabad",
        "Hyderabad Corridor — Demo Portfolio",
        "Active",
        68.0,
        64.0,
        1,
        "Sample twin-arch river crossing project used to preview infrastructure tracking and ML benchmarking.",
    ),
    (
        "BX-DEMO-002",
        "Krishna Deck Viaduct (Demo)",
        "Viaduct Deck",
        "Vijayawada",
        "Southern Highway — Demo Portfolio",
        "At Risk",
        58.0,
        45.0,
        1,
        "Sample multi-span concrete viaduct segment flagged for outdoor weather sensitivity.",
    ),
    (
        "BX-DEMO-003",
        "Godavari Pier Rehab (Demo)",
        "Pier Rehabilitation",
        "Rajahmundry",
        "Coastal Link — Demo Portfolio",
        "Active",
        74.0,
        76.0,
        1,
        "Sample substructure concrete pier strengthening package with favorable progress alignment.",
    ),
    (
        "BX-DEMO-004",
        "Outer Ring Overpass (Demo)",
        "Highway Overpass",
        "Hyderabad",
        "Metro Beltway — Demo Portfolio",
        "Completed",
        100.0,
        100.0,
        1,
        "Sample grade-separated urban highway overpass demonstrating completed inspection workflow.",
    ),
    (
        "BX-DEMO-005",
        "Hussain Sagar Steel Flyover (Demo)",
        "Highway Overpass",
        "Secunderabad",
        "Central Urban Arterial — Demo Portfolio",
        "At Risk",
        49.0,
        39.0,
        1,
        "Sample structural steel girder erection corridor flagged for complex urban staging constraints.",
    ),
    (
        "BX-DEMO-006",
        "Amaravati Cable Approaches (Demo)",
        "Viaduct Deck",
        "Vijayawada",
        "Riverfront Connector — Demo Portfolio",
        "Active",
        42.0,
        41.0,
        1,
        "Sample approach ramp piling and asphalt wearing-course corridor.",
    ),
    (
        "BX-DEMO-007",
        "Kovvur Approach Resurfacing (Demo)",
        "Pier Rehabilitation",
        "Rajahmundry",
        "East Delta Link — Demo Portfolio",
        "Completed",
        100.0,
        100.0,
        1,
        "Sample completed pavement and expansion-joint rehabilitation package.",
    ),
]


def get_db_path() -> str:
    """Resolve the active SQLite database path dynamically (honors BRIDGEX_DB_PATH)."""
    env_path = os.getenv("BRIDGEX_DB_PATH", "").strip()
    return env_path if env_path else DEFAULT_DB_PATH


def utc_now_iso() -> str:
    """Return an ISO-8601 UTC timestamp string."""
    return datetime.now(timezone.utc).isoformat()


def _create_connection(db_path: str) -> sqlite3.Connection:
    parent = os.path.dirname(os.path.abspath(db_path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=15.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def get_db_connection(db_path: str | None = None) -> Iterator[sqlite3.Connection]:
    """Yield an initialized SQLite connection wrapped in a transaction."""
    resolved_path = db_path or get_db_path()
    ensure_database_initialized(resolved_path)
    conn = _create_connection(resolved_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


_INITIALIZED_PATHS: set[str] = set()


def reset_db_init_cache() -> None:
    """Clear initialization cache (primarily useful for isolated pytest tmp databases)."""
    _INITIALIZED_PATHS.clear()


def ensure_database_initialized(db_path: str | None = None) -> str:
    """Run pending idempotent schema migrations safely for the target SQLite file."""
    resolved_path = os.path.abspath(db_path or get_db_path())
    if resolved_path in _INITIALIZED_PATHS and os.path.exists(resolved_path):
        return resolved_path

    conn = _create_connection(resolved_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            """
        )

        applied = {
            row["version"]
            for row in conn.execute("SELECT version FROM schema_migrations").fetchall()
        }

        if "001_create_users" not in applied:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    full_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('administrator', 'project_manager', 'viewer')),
                    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
                    assigned_projects_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);")
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                ("001_create_users", utc_now_iso()),
            )

        if "002_create_revoked_tokens" not in applied:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS revoked_tokens (
                    jti TEXT PRIMARY KEY,
                    expires_at INTEGER NOT NULL,
                    revoked_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at);"
            )
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                ("002_create_revoked_tokens", utc_now_iso()),
            )

        if "003_create_projects" not in applied:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    name TEXT NOT NULL,
                    project_type TEXT NOT NULL,
                    location TEXT NOT NULL,
                    corridor TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('Active', 'At Risk', 'Completed')),
                    planned_progress_pct REAL NOT NULL DEFAULT 0.0,
                    actual_progress_pct REAL NOT NULL DEFAULT 0.0,
                    is_demo_reference INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_reference IN (0, 1)),
                    notes TEXT NOT NULL DEFAULT '',
                    updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            now = utc_now_iso()
            for proj in SEEDED_REFERENCE_PROJECTS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO projects (
                        project_code, name, project_type, location, corridor,
                        status, planned_progress_pct, actual_progress_pct,
                        is_demo_reference, notes, updated_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);
                    """,
                    (*proj, now, now),
                )
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                ("003_create_projects", utc_now_iso()),
            )

        if "004_enrich_projects_geo_and_tasks" not in applied:
            existing_cols = {
                row["name"]
                for row in conn.execute("PRAGMA table_info(projects);").fetchall()
            }
            for col_name, col_def in [
                ("latitude", "REAL NULL"),
                ("longitude", "REAL NULL"),
                ("start_date", "TEXT NOT NULL DEFAULT ''"),
                ("expected_completion", "TEXT NOT NULL DEFAULT ''"),
                ("description", "TEXT NOT NULL DEFAULT ''"),
            ]:
                if col_name not in existing_cols:
                    conn.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_def};")

            geo_backfill = [
                (17.3850, 78.4867, "2026-02-10", "2026-12-20", "Sample twin-arch river crossing project used to preview infrastructure tracking and ML benchmarking.", "BX-DEMO-001"),
                (16.5062, 80.6480, "2026-03-01", "2027-03-15", "Sample multi-span concrete viaduct segment flagged for outdoor weather sensitivity.", "BX-DEMO-002"),
                (17.0005, 81.8040, "2026-01-18", "2026-11-30", "Sample substructure concrete pier strengthening package with favorable progress alignment.", "BX-DEMO-003"),
                (17.4401, 78.3489, "2025-11-05", "2026-09-12", "Sample grade-separated urban highway overpass demonstrating completed inspection workflow.", "BX-DEMO-004"),
                (17.4239, 78.4738, "2026-04-12", "2027-05-01", "Sample structural steel girder erection corridor flagged for complex urban staging constraints.", "BX-DEMO-005"),
                (16.5193, 80.6305, "2026-05-20", "2027-06-30", "Sample approach ramp piling and asphalt wearing-course corridor.", "BX-DEMO-006"),
                (17.0112, 81.7279, "2025-09-14", "2026-06-18", "Sample completed pavement and expansion-joint rehabilitation package.", "BX-DEMO-007"),
            ]
            for lat, lon, start_d, exp_d, desc, code in geo_backfill:
                conn.execute(
                    """
                    UPDATE projects
                    SET latitude = COALESCE(latitude, ?),
                        longitude = COALESCE(longitude, ?),
                        start_date = CASE WHEN start_date = '' THEN ? ELSE start_date END,
                        expected_completion = CASE WHEN expected_completion = '' THEN ? ELSE expected_completion END,
                        description = CASE WHEN description = '' THEN ? ELSE description END
                    WHERE project_code = ?;
                    """,
                    (lat, lon, start_d, exp_d, desc, code),
                )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS construction_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    project_code TEXT NOT NULL REFERENCES projects(project_code) ON DELETE CASCADE,
                    task_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    contractor TEXT NOT NULL,
                    planned_duration_days INTEGER NOT NULL,
                    actual_duration_days REAL NULL,
                    planned_progress_pct REAL NOT NULL DEFAULT 0.0,
                    actual_progress_pct REAL NOT NULL DEFAULT 0.0,
                    status TEXT NOT NULL CHECK (status IN ('Completed', 'In Progress', 'Pending', 'Delayed')),
                    crew_size INTEGER NOT NULL DEFAULT 10,
                    material_cost REAL NOT NULL DEFAULT 25000.0,
                    weather_risk INTEGER NOT NULL DEFAULT 2,
                    complexity_level INTEGER NOT NULL DEFAULT 5,
                    reporting_period TEXT NOT NULL DEFAULT '7d',
                    is_demo_reference INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_reference IN (0, 1)),
                    updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project ON construction_tasks(project_code);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON construction_tasks(status);")

            now = utc_now_iso()
            seeded_tasks = [
                ("TSK-0001", "BX-DEMO-001", "North Abutment Site Clearing (Demo)", "Site Preparation", "Apex Builders", 8, 9.2, 100.0, 100.0, "Completed", 6, 20266.29, 2, 4, "30d", 1),
                ("TSK-0002", "BX-DEMO-001", "Riverbank Trench Excavation (Demo)", "Excavation", "Apex Builders", 9, 10.7, 90.0, 85.0, "Delayed", 15, 59161.84, 2, 5, "7d", 1),
                ("TSK-0003", "BX-DEMO-001", "Main Arch Foundation Piling (Demo)", "Foundation Piling", "BridgeCore Engineering", 18, None, 60.0, 58.0, "In Progress", 18, 128000.0, 2, 7, "7d", 1),
                ("TSK-0004", "BX-DEMO-002", "Viaduct Pier Formwork & Pouring (Demo)", "Concrete Pouring", "Titan Infrastructure", 15, None, 65.0, 48.0, "In Progress", 16, 98500.0, 4, 7, "7d", 1),
                ("TSK-0005", "BX-DEMO-002", "Elevated Precast Bridge Decking (Demo)", "Bridge Decking", "Titan Infrastructure", 20, 24.4, 55.0, 40.0, "Delayed", 14, 145000.0, 4, 8, "7d", 1),
                ("TSK-0006", "BX-DEMO-003", "Substructure Pier Concrete Pouring (Demo)", "Concrete Pouring", "BridgeCore Engineering", 14, 13.8, 76.0, 78.0, "In Progress", 20, 92500.0, 2, 6, "14d", 1),
                ("TSK-0007", "BX-DEMO-004", "Overpass Final Structural Inspection (Demo)", "Structural Inspection", "Summit Civil Works", 4, 5.1, 100.0, 100.0, "Completed", 6, 12000.0, 1, 3, "30d", 1),
                ("TSK-0008", "BX-DEMO-005", "Urban Steel Girder Erection (Demo)", "Steel Erection", "MetroStruct Ltd", 24, 27.6, 50.0, 38.0, "Delayed", 22, 185000.0, 3, 9, "14d", 1),
                ("TSK-0009", "BX-DEMO-006", "Cable Approach Caisson Piling (Demo)", "Foundation Piling", "BridgeCore Engineering", 18, None, 45.0, 44.0, "In Progress", 18, 132000.0, 2, 7, "30d", 1),
                ("TSK-0010", "BX-DEMO-007", "Approach Carriageway Asphalt Paving (Demo)", "Asphalt Paving", "Apex Builders", 7, 8.9, 100.0, 100.0, "Completed", 12, 54000.0, 1, 4, "30d", 1),
            ]
            for t in seeded_tasks:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO construction_tasks (
                        task_code, project_code, task_name, category, contractor,
                        planned_duration_days, actual_duration_days, planned_progress_pct,
                        actual_progress_pct, status, crew_size, material_cost,
                        weather_risk, complexity_level, reporting_period,
                        is_demo_reference, updated_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);
                    """,
                    (*t, now, now),
                )

            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                ("004_enrich_projects_geo_and_tasks", utc_now_iso()),
            )

        if "005_telemetry_and_audit_tables" not in applied:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ml_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_code TEXT NULL REFERENCES projects(project_code) ON DELETE SET NULL,
                    requested_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    task_type TEXT NOT NULL,
                    contractor TEXT NOT NULL,
                    planned_duration INTEGER NOT NULL,
                    crew_size INTEGER NOT NULL,
                    material_cost REAL NOT NULL,
                    weather_risk INTEGER NOT NULL,
                    complexity_level INTEGER NOT NULL,
                    predicted_duration_days REAL NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ml_pred_created ON ml_predictions(created_at);")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS weather_observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_code TEXT NULL REFERENCES projects(project_code) ON DELETE SET NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    forecast_days INTEGER NOT NULL,
                    threshold_mm REAL NOT NULL,
                    rainy_days_count INTEGER NOT NULL,
                    total_rainfall_mm REAL NOT NULL,
                    record_kind TEXT NOT NULL DEFAULT 'forecast',
                    source TEXT NOT NULL DEFAULT 'Open-Meteo',
                    fetched_at TEXT NOT NULL
                );
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_weather_fetched ON weather_observations(fetched_at);")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cv_analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    result_id TEXT NOT NULL UNIQUE,
                    analysis_kind TEXT NOT NULL CHECK (analysis_kind IN ('single', 'comparison')),
                    project_code TEXT NULL,
                    model_name TEXT NOT NULL,
                    image_diff_score_pct REAL NULL,
                    semantic_change_pct REAL NULL,
                    detected_classes_count INTEGER NOT NULL DEFAULT 0,
                    csv_report_path TEXT NULL,
                    html_report_path TEXT NULL,
                    mask_path TEXT NULL,
                    verification_status TEXT NOT NULL DEFAULT 'Pending engineer review',
                    created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS generated_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_type TEXT NOT NULL,
                    export_format TEXT NOT NULL CHECK (export_format IN ('preview', 'pdf', 'csv')),
                    project_id TEXT NOT NULL,
                    row_count INTEGER NOT NULL DEFAULT 0,
                    generated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                    actor_username TEXT NOT NULL,
                    actor_role TEXT NOT NULL,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    details TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);")

            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                ("005_telemetry_and_audit_tables", utc_now_iso()),
            )

        conn.commit()
        _INITIALIZED_PATHS.add(resolved_path)
    finally:
        conn.close()

    return resolved_path


def check_database_health() -> bool:
    """Safely verify database connectivity with a lightweight read query."""
    try:
        with get_db_connection() as conn:
            conn.execute("SELECT 1;").fetchone()
        return True
    except Exception:
        return False
