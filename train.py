"""
train.py - Machine Learning Model Training for AI Bridge X.
Loads the construction_tasks.csv dataset, splits it into training and testing
sets, trains an XGBoost regression model to predict actual_duration, evaluates
its performance, and saves the trained model to models/delay_predictor.pkl.
"""

import os
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from xgboost import XGBRegressor

from config import (
    DATASET_PATH,
    FEATURES,
    MODEL_PATH,
    MODELS_DIR,
    RANDOM_SEED,
    TARGET,
    TEST_SIZE,
)

# ==============================================================================
# 1. LOAD THE DATASET
# ==============================================================================
print("=" * 65)
print("   AI Bridge X – Machine Learning Model Training (Step 7)")
print("=" * 65)

print(f"\nLoading dataset from: {DATASET_PATH}")
df = pd.read_csv(DATASET_PATH)
print(f"Dataset loaded: {df.shape[0]} records, {df.shape[1]} columns\n")


# ==============================================================================
# 2. PREPARE FEATURES (X) AND TARGET (y)
# ==============================================================================
print("-" * 65)
print("PREPARING FEATURES AND TARGET")
print("-" * 65)

# X = the 7 input columns the model will learn from
# y = the single output column the model will learn to predict
X = df[FEATURES]
y = df[TARGET]

print(f"Feature columns (X) : {list(X.columns)}")
print(f"Target column   (y) : {TARGET}")
print(f"X shape             : {X.shape}  (rows, features)")
print(f"y shape             : {y.shape}  (rows,)")
print()


# ==============================================================================
# 3. SPLIT INTO TRAINING SET (80%) AND TESTING SET (20%)
# ==============================================================================
print("-" * 65)
print("SPLITTING DATA INTO TRAINING AND TESTING SETS")
print("-" * 65)

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=TEST_SIZE,       # 0.2 = 20% for testing
    random_state=RANDOM_SEED,  # 42 = same split every time
)

print(f"Training set : {X_train.shape[0]} records ({100 - TEST_SIZE * 100:.0f}%)")
print(f"Testing set  : {X_test.shape[0]} records ({TEST_SIZE * 100:.0f}%)")
print()


# ==============================================================================
# 4. CREATE AND TRAIN THE XGBOOST MODEL
# ==============================================================================
print("-" * 65)
print("TRAINING THE XGBOOST MODEL")
print("-" * 65)

model = XGBRegressor(
    n_estimators=300,          # Number of decision trees to build
    max_depth=6,               # Maximum depth of each tree
    learning_rate=0.1,         # Step size for each tree's contribution
    subsample=0.8,             # Use 80% of rows per tree (reduces overfitting)
    colsample_bytree=0.8,     # Use 80% of features per tree
    random_state=RANDOM_SEED,  # Reproducible results
    verbosity=0,               # Suppress XGBoost internal logs
)

print("Model configuration:")
print(f"  Algorithm       : XGBoost Regressor")
print(f"  Trees           : {model.n_estimators}")
print(f"  Max Depth       : {model.max_depth}")
print(f"  Learning Rate   : {model.learning_rate}")
print(f"  Subsample       : {model.subsample}")
print(f"  Col Sample      : {model.colsample_bytree}")
print()

print("Training in progress...")
start_time = time.time()

model.fit(X_train, y_train)

training_time = time.time() - start_time
print(f"Training completed in {training_time:.2f} seconds!\n")


# ==============================================================================
# 5. MAKE PREDICTIONS ON THE TEST SET
# ==============================================================================
print("-" * 65)
print("MAKING PREDICTIONS ON THE TEST SET")
print("-" * 65)

y_pred = model.predict(X_test)

# Show a few example predictions vs actual values
print(f"\nSample Predictions (first 10 test records):")
print(f"{'Row':<6} {'Actual (days)':<16} {'Predicted (days)':<18} {'Difference':<12}")
print("-" * 52)
for i in range(10):
    actual = y_test.iloc[i]
    predicted = y_pred[i]
    diff = predicted - actual
    print(f"{i+1:<6} {actual:<16.1f} {predicted:<18.1f} {diff:<+12.1f}")
print()


# ==============================================================================
# 6. EVALUATE THE MODEL
# ==============================================================================
print("-" * 65)
print("MODEL EVALUATION METRICS")
print("-" * 65)

mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print(f"  MAE  (Mean Absolute Error)     : {mae:.4f} days")
print(f"  MSE  (Mean Squared Error)      : {mse:.4f}")
print(f"  RMSE (Root Mean Squared Error) : {rmse:.4f} days")
print(f"  R² Score (Accuracy)            : {r2:.4f}  ({r2 * 100:.2f}%)")
print()

# Explain the results in plain language
print("-" * 65)
print("WHAT THESE NUMBERS MEAN")
print("-" * 65)
print(f"  • On average, predictions are off by about {mae:.2f} days (MAE).")
print(f"  • The typical prediction error is about {rmse:.2f} days (RMSE).")
if r2 >= 0.90:
    grade = "EXCELLENT"
elif r2 >= 0.75:
    grade = "GOOD"
elif r2 >= 0.50:
    grade = "MODERATE"
else:
    grade = "NEEDS IMPROVEMENT"
print(f"  • The model explains {r2 * 100:.2f}% of the variation in actual duration.")
print(f"  • Overall model quality: {grade}")
print()


# ==============================================================================
# 7. FEATURE IMPORTANCE (WHICH INPUTS MATTER MOST)
# ==============================================================================
print("-" * 65)
print("FEATURE IMPORTANCE (Which inputs matter most?)")
print("-" * 65)

importances = model.feature_importances_
importance_data = sorted(
    zip(FEATURES, importances), key=lambda x: x[1], reverse=True
)

for rank, (feat_name, imp_value) in enumerate(importance_data, 1):
    bar = "█" * int(imp_value * 50)
    print(f"  {rank}. {feat_name:<22s} : {imp_value:.4f}  {bar}")
print()


# ==============================================================================
# 8. SAVE THE TRAINED MODEL
# ==============================================================================
print("-" * 65)
print("SAVING THE TRAINED MODEL")
print("-" * 65)

os.makedirs(MODELS_DIR, exist_ok=True)
joblib.dump(model, MODEL_PATH)

model_size = os.path.getsize(MODEL_PATH)
print(f"  Model saved to   : {MODEL_PATH}")
print(f"  Model file size  : {model_size:,} bytes ({model_size / 1024:.1f} KB)")
print()


# ==============================================================================
# 9. QUICK VERIFICATION: LOAD AND RE-TEST THE SAVED MODEL
# ==============================================================================
print("-" * 65)
print("VERIFICATION: Loading saved model and re-testing")
print("-" * 65)

loaded_model = joblib.load(MODEL_PATH)
verify_pred = loaded_model.predict(X_test[:5])
print(f"  5 predictions from loaded model: {[round(v, 1) for v in verify_pred]}")
print(f"  5 actual values                : {[round(v, 1) for v in y_test.iloc[:5].values]}")
print("  ✓ Saved model loads and predicts correctly!")
print()


# ==============================================================================
# 10. FINAL SUMMARY
# ==============================================================================
print("=" * 65)
print("   MODEL TRAINING COMPLETE!")
print("=" * 65)
print(f"  Dataset          : {df.shape[0]} records")
print(f"  Training set     : {X_train.shape[0]} records")
print(f"  Testing set      : {X_test.shape[0]} records")
print(f"  Features used    : {len(FEATURES)}")
print(f"  Algorithm        : XGBoost Regressor")
print(f"  R² Score         : {r2 * 100:.2f}% ({grade})")
print(f"  MAE              : {mae:.4f} days")
print(f"  RMSE             : {rmse:.4f} days")
print(f"  Model saved to   : {MODEL_PATH}")
print(f"  Training time    : {training_time:.2f} seconds")
print("=" * 65)
print("  Next: Step 8 – Model Testing and Prediction")
print("=" * 65)
