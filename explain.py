"""
explain.py - SHAP Explainability for AI Bridge X.
Loads the saved XGBoost model (models/delay_predictor.pkl) and the
construction_tasks.csv dataset, computes SHAP values for a 1,000-record
sample, and saves three explanation plots inside the plots/ folder.
"""

import os
import joblib
import matplotlib
matplotlib.use("Agg")  # Save plots directly to files without opening GUI windows
import matplotlib.pyplot as plt
import pandas as pd
import shap

from config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    PLOTS_DIR,
    RANDOM_SEED,
    TARGET,
)

# ==============================================================================
# 1. SETTINGS
# ==============================================================================
SAMPLE_SIZE = 1000  # Number of records to explain (fast & representative)

print("=" * 65)
print("   AI Bridge X – SHAP Explainability Analysis (Step 8)")
print("=" * 65)


# ==============================================================================
# 2. LOAD THE SAVED XGBOOST MODEL (NO RETRAINING)
# ==============================================================================
print(f"\nLoading saved model from : {MODEL_PATH}")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"Saved model not found at {MODEL_PATH}. Run 'python train.py' first."
    )

model = joblib.load(MODEL_PATH)
print(f"Loaded model type        : {type(model).__name__}")
print(f"Expected features ({model.n_features_in_})    : {[str(f) for f in model.feature_names_in_]}")


# ==============================================================================
# 3. LOAD THE DATASET AND SELECT A REPRODUCIBLE SAMPLE
# ==============================================================================
print(f"\nLoading dataset from     : {DATASET_PATH}")
df = pd.read_csv(DATASET_PATH)
print(f"Full dataset shape       : {df.shape[0]} rows, {df.shape[1]} columns")

# Pick 1,000 rows reproducibly without modifying the original CSV
sample_df = df.sample(n=min(SAMPLE_SIZE, len(df)), random_state=RANDOM_SEED).reset_index(drop=True)
X_sample = sample_df[FEATURES]
print(f"SHAP sample shape        : {X_sample.shape[0]} rows, {X_sample.shape[1]} features")


# ==============================================================================
# 4. CREATE SHAP TREEEXPLAINER AND COMPUTE SHAP VALUES
# ==============================================================================
print("\n" + "-" * 65)
print("COMPUTING SHAP VALUES WITH TreeExplainer")
print("-" * 65)

explainer = shap.TreeExplainer(model)
shap_values = explainer(X_sample)

print(f"SHAP values shape        : {shap_values.shape}")
print(f"Baseline average (days)  : {float(shap_values.base_values[0]):.2f} days")


# ==============================================================================
# 5. PRINT MEAN ABSOLUTE SHAP IMPORTANCE IN TERMINAL
# ==============================================================================
print("\n" + "-" * 65)
print("GLOBAL SHAP FEATURE IMPORTANCE (Average |Impact| in days)")
print("-" * 65)

mean_abs_shap = abs(shap_values.values).mean(axis=0)
ranked_features = sorted(zip(FEATURES, mean_abs_shap), key=lambda item: item[1], reverse=True)
for rank, (feat_name, impact_days) in enumerate(ranked_features, 1):
    print(f"  {rank}. {feat_name:<20s} : +/- {impact_days:.2f} days on average")


# ==============================================================================
# 6. INSPECT ONE INDIVIDUAL PREDICTION (USED FOR THE WATERFALL PLOT)
# ==============================================================================
example_index = 0
example_row = sample_df.iloc[example_index]
predicted_days = float(model.predict(X_sample.iloc[[example_index]])[0])
actual_days = float(example_row[TARGET])

print("\n" + "-" * 65)
print("INDIVIDUAL TASK EXPLANATION (Row 0 of Sample -> Waterfall Plot)")
print("-" * 65)
print(f"  Task ID          : {example_row['task_id']}")
print(f"  Task Type        : {example_row['task_type']} (code {example_row['task_type_code']})")
print(f"  Contractor       : {example_row['contractor']} (code {example_row['contractor_code']})")
print(f"  Planned Duration : {example_row['planned_duration']} days")
print(f"  Weather Risk     : {example_row['weather_risk']} / 5")
print(f"  Complexity Level : {example_row['complexity_level']} / 10")
print(f"  Model Prediction : {predicted_days:.2f} days")
print(f"  Actual Duration  : {actual_days:.2f} days")


# ==============================================================================
# 7. GENERATE AND SAVE SHAP PLOTS TO plots/
# ==============================================================================
os.makedirs(PLOTS_DIR, exist_ok=True)
print("\n" + "-" * 65)
print(f"SAVING SHAP PLOTS TO: {PLOTS_DIR}")
print("-" * 65)

# --- PLOT 1: SHAP Feature Importance (Bar Plot) ---
plt.figure(figsize=(10, 6))
shap.plots.bar(shap_values, show=False)
plt.title("SHAP Feature Importance (Average Impact on Predicted Duration)")
bar_plot_path = os.path.join(PLOTS_DIR, "shap_feature_importance.png")
plt.savefig(bar_plot_path, dpi=150, bbox_inches="tight")
plt.close("all")
print(f"  Saved: {bar_plot_path}")

# --- PLOT 2: SHAP Summary Plot (Beeswarm) ---
plt.figure(figsize=(10, 6))
shap.plots.beeswarm(shap_values, show=False)
plt.title("SHAP Summary Plot (How Feature Values Push Duration Up or Down)")
beeswarm_plot_path = os.path.join(PLOTS_DIR, "shap_summary_beeswarm.png")
plt.savefig(beeswarm_plot_path, dpi=150, bbox_inches="tight")
plt.close("all")
print(f"  Saved: {beeswarm_plot_path}")

# --- PLOT 3: SHAP Waterfall Plot (Single Prediction Explanation) ---
plt.figure(figsize=(10, 6))
shap.plots.waterfall(shap_values[example_index], show=False)
plt.title(f"SHAP Waterfall Plot (Task ID {example_row['task_id']}: {example_row['task_type']})")
waterfall_plot_path = os.path.join(PLOTS_DIR, "shap_waterfall_single_task.png")
plt.savefig(waterfall_plot_path, dpi=150, bbox_inches="tight")
plt.close("all")
print(f"  Saved: {waterfall_plot_path}")

print("\n" + "=" * 65)
print("   SHAP EXPLAINABILITY COMPLETE!")
print("=" * 65)
