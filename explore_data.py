"""
explore_data.py - Exploratory Data Analysis (EDA) for AI Bridge X.
Loads the construction_tasks.csv dataset, inspects it, calculates statistics,
and generates beginner-friendly visualizations saved to the plots/ folder.
"""

import os
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Use non-interactive backend so plots save without a GUI window
import matplotlib.pyplot as plt
import seaborn as sns

from config import DATASET_PATH, PLOTS_DIR, TASK_TYPES, CONTRACTORS

# ==============================================================================
# 0. STYLE SETTINGS (makes all our charts look clean and professional)
# ==============================================================================
sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
plt.rcParams["figure.dpi"] = 120
plt.rcParams["savefig.bbox"] = "tight"


# ==============================================================================
# 1. LOAD THE DATASET
# ==============================================================================
print("=" * 65)
print("   AI Bridge X – Exploratory Data Analysis (EDA)")
print("=" * 65)

print(f"\nLoading dataset from: {DATASET_PATH}")
df = pd.read_csv(DATASET_PATH)
print("Dataset loaded successfully!\n")


# ==============================================================================
# 2. FIRST FIVE RECORDS
# ==============================================================================
print("-" * 65)
print("FIRST 5 RECORDS")
print("-" * 65)
print(df.head().to_string(index=False))
print()


# ==============================================================================
# 3. DATASET SHAPE, COLUMNS, AND DATA TYPES
# ==============================================================================
print("-" * 65)
print("DATASET SHAPE")
print("-" * 65)
print(f"Rows    : {df.shape[0]}")
print(f"Columns : {df.shape[1]}")
print()

print("-" * 65)
print("COLUMN NAMES AND DATA TYPES")
print("-" * 65)
print(df.dtypes.to_string())
print()


# ==============================================================================
# 4. CHECK FOR MISSING VALUES AND DUPLICATES
# ==============================================================================
print("-" * 65)
print("MISSING VALUES PER COLUMN")
print("-" * 65)
missing = df.isnull().sum()
print(missing.to_string())
total_missing = missing.sum()
if total_missing == 0:
    print("\n✓ No missing values found — the dataset is complete!")
else:
    print(f"\n⚠ Total missing values: {total_missing}")
print()

print("-" * 65)
print("DUPLICATE RECORDS")
print("-" * 65)
duplicates = df.duplicated().sum()
print(f"Duplicate rows: {duplicates}")
if duplicates == 0:
    print("✓ No duplicate records found — every row is unique!")
else:
    print(f"⚠ Found {duplicates} duplicate rows — consider removing them.")
print()


# ==============================================================================
# 5. DESCRIPTIVE STATISTICS (NUMERIC COLUMNS)
# ==============================================================================
print("-" * 65)
print("DESCRIPTIVE STATISTICS (Numeric Columns)")
print("-" * 65)
print(df.describe().round(2).to_string())
print()


# ==============================================================================
# 6. PLANNED DURATION vs ACTUAL DURATION ANALYSIS
# ==============================================================================
print("-" * 65)
print("PLANNED DURATION vs ACTUAL DURATION")
print("-" * 65)
df["delay"] = df["actual_duration"] - df["planned_duration"]
print(f"Average Planned Duration  : {df['planned_duration'].mean():.2f} days")
print(f"Average Actual Duration   : {df['actual_duration'].mean():.2f} days")
print(f"Average Delay             : {df['delay'].mean():.2f} days")
print(f"Tasks finishing EARLY  (actual < planned) : {(df['delay'] < 0).sum()}")
print(f"Tasks finishing ON TIME (actual = planned) : {(df['delay'] == 0).sum()}")
print(f"Tasks finishing LATE   (actual > planned) : {(df['delay'] > 0).sum()}")
print()


# ==============================================================================
# 7. TASK TYPE ANALYSIS
# ==============================================================================
print("-" * 65)
print("TASK TYPE BREAKDOWN")
print("-" * 65)
task_counts = df["task_type"].value_counts()
print(task_counts.to_string())
print()

print("Average Actual Duration per Task Type:")
task_avg = df.groupby("task_type")["actual_duration"].mean().sort_values(ascending=False)
for task_name, avg_dur in task_avg.items():
    print(f"  {task_name:<25s} : {avg_dur:.2f} days")
print()


# ==============================================================================
# 8. CONTRACTOR ANALYSIS
# ==============================================================================
print("-" * 65)
print("CONTRACTOR BREAKDOWN")
print("-" * 65)
contractor_counts = df["contractor"].value_counts()
print(contractor_counts.to_string())
print()

print("Average Actual Duration per Contractor:")
contractor_avg = df.groupby("contractor")["actual_duration"].mean().sort_values(ascending=False)
for c_name, avg_dur in contractor_avg.items():
    print(f"  {c_name:<25s} : {avg_dur:.2f} days")
print()


# ==============================================================================
# 9. WEATHER RISK AND COMPLEXITY ANALYSIS
# ==============================================================================
print("-" * 65)
print("WEATHER RISK vs ACTUAL DURATION")
print("-" * 65)
weather_avg = df.groupby("weather_risk")["actual_duration"].mean()
for risk_level, avg_dur in weather_avg.items():
    print(f"  Weather Risk {risk_level} : Average Actual Duration = {avg_dur:.2f} days")
print()

print("-" * 65)
print("COMPLEXITY LEVEL vs ACTUAL DURATION")
print("-" * 65)
complexity_avg = df.groupby("complexity_level")["actual_duration"].mean()
for comp_level, avg_dur in complexity_avg.items():
    print(f"  Complexity {comp_level:>2d} : Average Actual Duration = {avg_dur:.2f} days")
print()


# ==============================================================================
# 10. GENERATE AND SAVE GRAPHS TO THE plots/ FOLDER
# ==============================================================================
os.makedirs(PLOTS_DIR, exist_ok=True)
print("-" * 65)
print(f"GENERATING GRAPHS → Saving to: {PLOTS_DIR}")
print("-" * 65)


# --- GRAPH 1: Distribution of Actual Duration ---
fig, ax = plt.subplots(figsize=(10, 5))
sns.histplot(df["actual_duration"], bins=50, kde=True, color="steelblue", ax=ax)
ax.set_title("Distribution of Actual Duration (days)")
ax.set_xlabel("Actual Duration (days)")
ax.set_ylabel("Number of Tasks")
path1 = os.path.join(PLOTS_DIR, "01_actual_duration_distribution.png")
fig.savefig(path1)
plt.close(fig)
print(f"  ✓ Saved: {path1}")


# --- GRAPH 2: Planned vs Actual Duration (Scatter Plot) ---
fig, ax = plt.subplots(figsize=(8, 8))
ax.scatter(df["planned_duration"], df["actual_duration"],
           alpha=0.25, s=12, color="coral", edgecolors="none")
# Draw a perfect "on-time" diagonal line
max_val = max(df["planned_duration"].max(), df["actual_duration"].max())
ax.plot([0, max_val], [0, max_val], "--", color="gray", linewidth=1, label="On-time line")
ax.set_title("Planned Duration vs Actual Duration")
ax.set_xlabel("Planned Duration (days)")
ax.set_ylabel("Actual Duration (days)")
ax.legend()
path2 = os.path.join(PLOTS_DIR, "02_planned_vs_actual_scatter.png")
fig.savefig(path2)
plt.close(fig)
print(f"  ✓ Saved: {path2}")


# --- GRAPH 3: Average Actual Duration by Task Type (Bar Chart) ---
fig, ax = plt.subplots(figsize=(10, 6))
task_avg_sorted = df.groupby("task_type")["actual_duration"].mean().sort_values(ascending=True)
task_avg_sorted.plot.barh(ax=ax, color="teal")
ax.set_title("Average Actual Duration by Task Type")
ax.set_xlabel("Average Actual Duration (days)")
ax.set_ylabel("")
path3 = os.path.join(PLOTS_DIR, "03_avg_duration_by_task_type.png")
fig.savefig(path3)
plt.close(fig)
print(f"  ✓ Saved: {path3}")


# --- GRAPH 4: Average Actual Duration by Contractor (Bar Chart) ---
fig, ax = plt.subplots(figsize=(9, 5))
contractor_avg_sorted = df.groupby("contractor")["actual_duration"].mean().sort_values(ascending=True)
contractor_avg_sorted.plot.barh(ax=ax, color="darkorange")
ax.set_title("Average Actual Duration by Contractor")
ax.set_xlabel("Average Actual Duration (days)")
ax.set_ylabel("")
path4 = os.path.join(PLOTS_DIR, "04_avg_duration_by_contractor.png")
fig.savefig(path4)
plt.close(fig)
print(f"  ✓ Saved: {path4}")


# --- GRAPH 5: Actual Duration by Weather Risk (Box Plot) ---
fig, ax = plt.subplots(figsize=(9, 6))
sns.boxplot(x="weather_risk", y="actual_duration", data=df, palette="YlOrRd", ax=ax)
ax.set_title("Actual Duration by Weather Risk Level")
ax.set_xlabel("Weather Risk (1 = Low, 5 = Severe)")
ax.set_ylabel("Actual Duration (days)")
path5 = os.path.join(PLOTS_DIR, "05_duration_by_weather_risk.png")
fig.savefig(path5)
plt.close(fig)
print(f"  ✓ Saved: {path5}")


# --- GRAPH 6: Actual Duration by Complexity Level (Box Plot) ---
fig, ax = plt.subplots(figsize=(12, 6))
sns.boxplot(x="complexity_level", y="actual_duration", data=df, palette="Blues", ax=ax)
ax.set_title("Actual Duration by Complexity Level")
ax.set_xlabel("Complexity Level (1 = Simple, 10 = Very Complex)")
ax.set_ylabel("Actual Duration (days)")
path6 = os.path.join(PLOTS_DIR, "06_duration_by_complexity.png")
fig.savefig(path6)
plt.close(fig)
print(f"  ✓ Saved: {path6}")


# --- GRAPH 7: Correlation Heatmap (Numeric Features) ---
fig, ax = plt.subplots(figsize=(10, 8))
numeric_cols = [
    "task_type_code", "contractor_code", "planned_duration",
    "crew_size", "material_cost", "weather_risk",
    "complexity_level", "actual_duration",
]
corr_matrix = df[numeric_cols].corr().round(2)
sns.heatmap(corr_matrix, annot=True, cmap="coolwarm", center=0,
            fmt=".2f", linewidths=0.5, ax=ax)
ax.set_title("Correlation Heatmap of Numeric Features")
path7 = os.path.join(PLOTS_DIR, "07_correlation_heatmap.png")
fig.savefig(path7)
plt.close(fig)
print(f"  ✓ Saved: {path7}")


# --- GRAPH 8: Task Type Distribution (Count Bar Chart) ---
fig, ax = plt.subplots(figsize=(10, 5))
sns.countplot(y="task_type", data=df, order=df["task_type"].value_counts().index,
              palette="Set2", ax=ax)
ax.set_title("Number of Tasks per Task Type")
ax.set_xlabel("Count")
ax.set_ylabel("")
path8 = os.path.join(PLOTS_DIR, "08_task_type_counts.png")
fig.savefig(path8)
plt.close(fig)
print(f"  ✓ Saved: {path8}")


# ==============================================================================
# 11. FINAL SUMMARY
# ==============================================================================
print()
print("=" * 65)
print("   EDA COMPLETE!")
print("=" * 65)
print(f"Total records analyzed : {len(df)}")
print(f"Graphs saved           : 8 charts in {PLOTS_DIR}")
print(f"Missing values         : {total_missing}")
print(f"Duplicate rows         : {duplicates}")
print("Next step: Train the Machine Learning model (Step 7).")
print("=" * 65)
