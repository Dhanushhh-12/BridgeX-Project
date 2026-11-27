"""
config.py - Central configuration file for the AI Bridge X project.
All scripts (data generation, model training, testing, and prediction)
import their shared paths, categories, features, and helper functions from here.
"""

import os

# ==============================================================================
# 1. PROJECT FOLDER & FILE PATHS
# ==============================================================================
# Automatically finds the main project folder where config.py is saved
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Subfolders inside the main project directory
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
PLOTS_DIR = os.path.join(BASE_DIR, "plots")
TESTS_DIR = os.path.join(BASE_DIR, "tests")

# Exact file paths for the dataset and saved model
DATASET_PATH = os.path.join(DATA_DIR, "construction_tasks.csv")
MODEL_PATH = os.path.join(MODELS_DIR, "delay_predictor.pkl")

# ==============================================================================
# 2. DATASET & TRAINING SETTINGS
# ==============================================================================
NUM_RECORDS = 6000       # Number of synthetic construction task records to generate
RANDOM_SEED = 42         # Keeps random numbers repeatable across runs
TEST_SIZE = 0.2          # 20% of data reserved for testing, 80% for training

# ==============================================================================
# 3. PROJECT CATEGORIES (TEXT -> NUMBERS)
# ==============================================================================
TASK_TYPES = [
    "Site Preparation",
    "Excavation",
    "Foundation Piling",
    "Concrete Pouring",
    "Steel Erection",
    "Bridge Decking",
    "Asphalt Paving",
    "Structural Inspection",
]

CONTRACTORS = [
    "Apex Builders",
    "BridgeCore Engineering",
    "MetroStruct Ltd",
    "Summit Civil Works",
    "Titan Infrastructure",
]

# ==============================================================================
# 4. MACHINE LEARNING FEATURES & TARGET
# ==============================================================================
FEATURES = [
    "task_type_code",      # Encoded number from TASK_TYPES
    "contractor_code",     # Encoded number from CONTRACTORS
    "planned_duration",    # Planned days to finish the task
    "crew_size",           # Number of workers assigned
    "material_cost",       # Estimated material cost (in USD)
    "weather_risk",        # Weather risk score (e.g., 1 = low, 5 = severe)
    "complexity_level",    # Engineering complexity score (1 to 10)
]

TARGET = "actual_duration"  # What the ML model learns to predict (in days)

# ==============================================================================
# 5. HELPER FUNCTION: TEXT TO NUMBER ENCODING
# ==============================================================================
def encode(value: str, category_list: list) -> int:
    """
    Convert a text category (like 'Excavation') into a whole number
    based on its position in category_list.
    """
    if value not in category_list:
        raise ValueError(
            f"Unknown value '{value}'. Expected one of: {category_list}"
        )
    return category_list.index(value)


# ==============================================================================
# 6. QUICK SELF-CHECK (RUNS ONLY WHEN YOU RUN `python config.py` DIRECTLY)
# ==============================================================================
if __name__ == "__main__":
    print("AI Bridge X Configuration Loaded Successfully!")
    print(f"Base Directory : {BASE_DIR}")
    print(f"Data Folder    : {DATA_DIR}")
    print(f"Records Target : {NUM_RECORDS}")
    print(f"Task Types     : {len(TASK_TYPES)} categories")
    print(f"Contractors    : {len(CONTRACTORS)} categories")
    print(f"ML Features    : {len(FEATURES)} inputs -> Target: '{TARGET}'")
    print("Encode Test    : 'Excavation' ->", encode("Excavation", TASK_TYPES))
    print("Encode Test    : 'BridgeCore Engineering' ->", encode("BridgeCore Engineering", CONTRACTORS))
