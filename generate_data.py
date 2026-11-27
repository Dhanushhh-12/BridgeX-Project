"""
generate_data.py - Generates a realistic synthetic dataset of 6,000
construction tasks for AI Bridge X and saves it to data/construction_tasks.csv.
"""

import csv
import os
import random

# Import shared settings and helper function from config.py
from config import (
    CONTRACTORS,
    DATASET_PATH,
    FEATURES,
    NUM_RECORDS,
    RANDOM_SEED,
    TARGET,
    TASK_TYPES,
    encode,
)

# ==============================================================================
# 1. REALISTIC BASELINE PROFILES FOR TASK TYPES AND CONTRACTORS
# ==============================================================================
# Format: task_name: (min_days, max_days, min_crew, max_crew, min_cost, max_cost)
TASK_PROFILES = {
    "Site Preparation":      (5,  12, 6,  14, 15000,  45000),
    "Excavation":            (7,  18, 8,  18, 25000,  75000),
    "Foundation Piling":     (12, 28, 10, 24, 60000,  180000),
    "Concrete Pouring":      (8,  20, 12, 26, 45000,  140000),
    "Steel Erection":        (14, 35, 14, 30, 90000,  260000),
    "Bridge Decking":        (10, 25, 12, 24, 70000,  200000),
    "Asphalt Paving":        (4,  10, 8,  18, 30000,  90000),
    "Structural Inspection": (2,  6,  3,  8,  5000,   20000),
}
DEFAULT_TASK_PROFILE = (6, 18, 8, 20, 20000, 80000)

# Slight speed differences per contractor (< 1.0 means faster, > 1.0 means slower)
CONTRACTOR_SPEED_FACTOR = {
    "Apex Builders":          0.96,
    "BridgeCore Engineering": 0.92,
    "MetroStruct Ltd":        1.03,
    "Summit Civil Works":     1.00,
    "Titan Infrastructure":   1.09,
}


# ==============================================================================
# 2. GENERATE ONE REALISTIC CONSTRUCTION TASK RECORD
# ==============================================================================
def generate_single_record(task_id: int) -> dict:
    """Create one realistic construction task dictionary."""
    task_type = random.choice(TASK_TYPES)
    contractor = random.choice(CONTRACTORS)

    # Convert text categories into numbers using encode() from config.py
    task_type_code = encode(task_type, TASK_TYPES)
    contractor_code = encode(contractor, CONTRACTORS)

    # Look up realistic ranges for the chosen task type
    min_d, max_d, min_crew, max_crew, min_cost, max_cost = TASK_PROFILES.get(
        task_type, DEFAULT_TASK_PROFILE
    )

    # Generate task inputs (features)
    complexity_level = random.randint(1, 10)   # 1 = simple, 10 = very complex
    weather_risk = random.randint(1, 5)        # 1 = clear, 5 = severe weather risk

    # More complex tasks tend to have slightly longer planned duration, larger crew, higher cost
    complexity_boost = (complexity_level - 1) / 9.0  # 0.0 to 1.0

    planned_duration = round(
        random.uniform(min_d, max_d) * (0.85 + 0.30 * complexity_boost)
    )
    planned_duration = max(1, planned_duration)

    crew_size = round(
        random.uniform(min_crew, max_crew) * (0.85 + 0.25 * complexity_boost)
    )
    crew_size = max(2, crew_size)

    material_cost = round(
        random.uniform(min_cost, max_cost) * (0.85 + 0.35 * complexity_boost), 2
    )

    # Calculate realistic actual_duration (what the ML model will learn to predict)
    contractor_factor = CONTRACTOR_SPEED_FACTOR.get(contractor, 1.0)

    # Bad weather adds delay days; larger crews slightly reduce delay
    weather_delay = (weather_risk - 1) * random.uniform(0.6, 1.4)
    complexity_delay = (complexity_level - 5) * 0.35
    crew_efficiency = -0.06 * (crew_size - ((min_crew + max_crew) / 2))
    random_noise = random.gauss(0, 1.0)  # Natural real-world unpredictability

    actual_duration = (
        planned_duration * contractor_factor
        + weather_delay
        + complexity_delay
        + crew_efficiency
        + random_noise
    )
    actual_duration = max(1.0, round(actual_duration, 1))

    return {
        "task_id": task_id,
        "task_type": task_type,
        "contractor": contractor,
        "task_type_code": task_type_code,
        "contractor_code": contractor_code,
        "planned_duration": planned_duration,
        "crew_size": crew_size,
        "material_cost": material_cost,
        "weather_risk": weather_risk,
        "complexity_level": complexity_level,
        TARGET: actual_duration,
    }


# ==============================================================================
# 3. GENERATE ALL 6,000 RECORDS AND SAVE TO CSV
# ==============================================================================
def generate_dataset() -> None:
    """Generate NUM_RECORDS construction tasks and save them to DATASET_PATH."""
    # Set the random seed so the generated data is reproducible
    random.seed(RANDOM_SEED)

    # Make sure the 'data' folder exists before saving
    os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)

    # Define the exact CSV column order using FEATURES and TARGET from config.py
    columns = ["task_id", "task_type", "contractor"] + FEATURES + [TARGET]

    records = [generate_single_record(i) for i in range(1, NUM_RECORDS + 1)]

    with open(DATASET_PATH, mode="w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(records)

    print("Dataset generation complete!")
    print(f"Total records generated : {len(records)}")
    print(f"Saved dataset to        : {DATASET_PATH}")
    print(f"Columns ({len(columns)})           : {columns}")


if __name__ == "__main__":
    generate_dataset()
