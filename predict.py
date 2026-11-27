"""
predict.py - AI Prediction System for AI Bridge X.
Loads the saved XGBoost regression model (models/delay_predictor.pkl),
runs a sample test prediction from the dataset (with prediction error),
validates interactive user inputs, encodes categorical fields using config.py,
and clearly displays the predicted actual duration in days.
"""

import os
import joblib
import pandas as pd

from config import (
    CONTRACTORS,
    FEATURES,
    MODEL_PATH,
    TARGET,
    TASK_TYPES,
    encode,
)


# ==============================================================================
# 1. LOAD THE SAVED MODEL (NO RETRAINING)
# ==============================================================================
def load_trained_model():
    """Load the saved XGBoost model from MODEL_PATH."""
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Saved model not found at '{MODEL_PATH}'. Run 'python train.py' first."
        )
    model = joblib.load(MODEL_PATH)
    return model


# ==============================================================================
# 2. MAKE A PREDICTION USING EXACT FEATURES AND ORDER
# ==============================================================================
def predict_duration(
    model,
    task_type: str,
    contractor: str,
    planned_duration: int,
    crew_size: int,
    material_cost: float,
    weather_risk: int,
    complexity_level: int,
) -> float:
    """Encode text inputs, arrange features in exact order, and predict days."""
    task_type_code = encode(task_type, TASK_TYPES)
    contractor_code = encode(contractor, CONTRACTORS)

    input_row = {
        "task_type_code": task_type_code,
        "contractor_code": contractor_code,
        "planned_duration": planned_duration,
        "crew_size": crew_size,
        "material_cost": material_cost,
        "weather_risk": weather_risk,
        "complexity_level": complexity_level,
    }

    # Build a 1-row DataFrame with the exact FEATURES column names and order
    X_input = pd.DataFrame([input_row])[FEATURES]
    predicted_days = float(model.predict(X_input)[0])
    return round(predicted_days, 1)


# ==============================================================================
# 3. DISPLAY PREDICTION RESULT CLEARLY
# ==============================================================================
def display_prediction(
    title: str,
    task_type: str,
    contractor: str,
    planned_duration: int,
    crew_size: int,
    material_cost: float,
    weather_risk: int,
    complexity_level: int,
    predicted_days: float,
    recorded_actual: float | None = None,
) -> None:
    """Print entered task inputs, predicted actual duration, and optional error check."""
    diff_from_plan = round(predicted_days - planned_duration, 1)

    if diff_from_plan > 0:
        plan_note = f"{diff_from_plan:.1f} days longer than your {planned_duration}-day plan"
    elif diff_from_plan < 0:
        plan_note = f"{abs(diff_from_plan):.1f} days shorter than your {planned_duration}-day plan"
    else:
        plan_note = f"matches your {planned_duration}-day plan"

    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)
    print("  [1] Task Details Entered:")
    print(f"      - Task Type        : {task_type} (encoded as {encode(task_type, TASK_TYPES)})")
    print(f"      - Contractor       : {contractor} (encoded as {encode(contractor, CONTRACTORS)})")
    print(f"      - Planned Duration : {planned_duration} days")
    print(f"      - Crew Size        : {crew_size} workers")
    print(f"      - Material Cost    : ${material_cost:,.2f}")
    print(f"      - Weather Risk     : {weather_risk} / 5")
    print(f"      - Complexity Level : {complexity_level} / 10")
    print("-" * 65)
    print(f"  [2] AI Model Output (Target: {TARGET}):")
    print(f"      - Predicted Actual Duration : {predicted_days:.1f} days")
    print(
        f"      - What This Means           : Based on your inputs, the model estimates "
        f"this task will take {predicted_days:.1f} days in total"
    )
    print(f"                                    ({plan_note}).")

    if recorded_actual is not None:
        signed_error = round(predicted_days - recorded_actual, 1)
        abs_error = round(abs(signed_error), 1)
        direction = "over" if signed_error > 0 else ("under" if signed_error < 0 else "exact match with")
        print("-" * 65)
        print("  [3] Accuracy Check (Predicted vs. Recorded CSV Actual):")
        print(f"      - Recorded Actual Duration  : {recorded_actual:.1f} days")
        print(f"      - Prediction Error          : {signed_error:+.1f} days ({abs_error:.1f} days {direction} actual)")
    print("=" * 65)


# ==============================================================================
# 4. VALIDATE USER INPUTS SAFELY
# ==============================================================================
def prompt_choice(prompt_label: str, options: list[str]) -> str:
    """Prompt the user to pick a valid option by number or exact name."""
    print(f"\nAvailable {prompt_label}s:")
    for idx, option in enumerate(options, start=1):
        print(f"  {idx}. {option}")

    lookup = {opt.lower(): opt for opt in options}

    while True:
        raw = input(f"Enter {prompt_label} (number 1-{len(options)} or name): ").strip()
        if not raw:
            print("  Invalid input: value cannot be empty. Please try again.")
            continue

        if raw.isdigit():
            choice_num = int(raw)
            if 1 <= choice_num <= len(options):
                return options[choice_num - 1]
            print(f"  Invalid number: please enter a number from 1 to {len(options)}.")
            continue

        if raw.lower() in lookup:
            return lookup[raw.lower()]

        print(f"  Invalid {prompt_label}: '{raw}' not recognized. Please try again.")


def prompt_number(
    prompt_text: str,
    num_type: type,
    min_val: float,
    max_val: float,
    example: str,
):
    """Prompt until the user enters a valid int/float within [min_val, max_val]."""
    while True:
        raw = input(prompt_text).strip()
        if not raw:
            print(f"  Empty input: please enter a value between {min_val} and {max_val} (e.g., {example}).")
            continue

        # Allow users to type formatting characters like '$85,000' safely
        cleaned = raw.replace("$", "").replace(",", "")
        try:
            value = num_type(cleaned)
        except ValueError:
            type_name = "whole number" if num_type is int else "number"
            print(f"  Invalid input '{raw}': please enter a valid {type_name} (e.g., {example}).")
            continue

        if value < min_val or value > max_val:
            print(f"  Out of range ({value}): please enter a value from {min_val} to {max_val}.")
            continue

        return value


# ==============================================================================
# 5. MAIN PREDICTION WORKFLOW
# ==============================================================================
def main() -> None:
    print("=" * 65)
    print("   AI Bridge X – Actual Duration Prediction System (Step 9)")
    print("=" * 65)

    model = load_trained_model()
    print(f"Loaded model : {type(model).__name__} from {MODEL_PATH}")
    print(f"Model target : {TARGET} (in days)")
    print(f"Features ({model.n_features_in_}): {[str(f) for f in model.feature_names_in_]}")

    # --- Sample prediction using Row 1 (task_id = 1) from construction_tasks.csv ---
    sample_pred = predict_duration(
        model=model,
        task_type="Excavation",
        contractor="Apex Builders",
        planned_duration=9,
        crew_size=15,
        material_cost=59161.84,
        weather_risk=2,
        complexity_level=5,
    )
    display_prediction(
        title="SAMPLE TEST RECORD (Dataset Row 1: Task ID 1)",
        task_type="Excavation",
        contractor="Apex Builders",
        planned_duration=9,
        crew_size=15,
        material_cost=59161.84,
        weather_risk=2,
        complexity_level=5,
        predicted_days=sample_pred,
        recorded_actual=10.7,
    )

    # --- Interactive predictions from user input ---
    print("\nNow enter details for a construction task to predict its actual duration:")
    while True:
        try:
            task_type = prompt_choice("Task Type", TASK_TYPES)
            contractor = prompt_choice("Contractor", CONTRACTORS)
            planned_duration = prompt_number(
                "Enter Planned Duration in days (1 to 365): ", int, 1, 365, "14"
            )
            crew_size = prompt_number(
                "Enter Crew Size in workers (1 to 500): ", int, 1, 500, "16"
            )
            material_cost = prompt_number(
                "Enter Material Cost in USD (100 to 10000000): ", float, 100.0, 10000000.0, "85000"
            )
            weather_risk = prompt_number(
                "Enter Weather Risk (1 = low, 5 = severe): ", int, 1, 5, "3"
            )
            complexity_level = prompt_number(
                "Enter Complexity Level (1 = simple, 10 = very complex): ", int, 1, 10, "7"
            )

            predicted_days = predict_duration(
                model=model,
                task_type=task_type,
                contractor=contractor,
                planned_duration=planned_duration,
                crew_size=crew_size,
                material_cost=material_cost,
                weather_risk=weather_risk,
                complexity_level=complexity_level,
            )

            display_prediction(
                title="AI BRIDGE X – PREDICTED ACTUAL DURATION",
                task_type=task_type,
                contractor=contractor,
                planned_duration=planned_duration,
                crew_size=crew_size,
                material_cost=material_cost,
                weather_risk=weather_risk,
                complexity_level=complexity_level,
                predicted_days=predicted_days,
            )

            again = input("\nPredict another task? (y/n): ").strip().lower()
            if again not in ("y", "yes"):
                print("\nExiting AI Bridge X Prediction System. Goodbye!")
                break
        except (KeyboardInterrupt, EOFError):
            print("\n\nPrediction session ended.")
            break


if __name__ == "__main__":
    main()
