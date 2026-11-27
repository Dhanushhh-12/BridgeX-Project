import type { PredictionRequestPayload } from '../types/api'

/**
 * VERIFIED ML MODEL METADATA & EXPLAINABILITY BENCHMARKS
 * -------------------------------------------------------------------------
 * All constants, categories, metrics, and global SHAP importances below were
 * verified directly from:
 *   - config.py (TASK_TYPES, CONTRACTORS, FEATURES, TARGET)
 *   - train.py & models/delay_predictor.pkl (XGBRegressor on 80/20 split, seed 42)
 *   - explain.py (SHAP TreeExplainer on 1,000-row reproducible sample)
 */

// Exact order used by config.encode() during training and inference
export const TASK_TYPES = [
  'Site Preparation',
  'Excavation',
  'Foundation Piling',
  'Concrete Pouring',
  'Steel Erection',
  'Bridge Decking',
  'Asphalt Paving',
  'Structural Inspection',
] as const

// Exact order used by config.encode() during training and inference
export const CONTRACTORS = [
  'Apex Builders',
  'BridgeCore Engineering',
  'MetroStruct Ltd',
  'Summit Civil Works',
  'Titan Infrastructure',
] as const

export const MODEL_FEATURE_ORDER = [
  'task_type_code',
  'contractor_code',
  'planned_duration',
  'crew_size',
  'material_cost',
  'weather_risk',
  'complexity_level',
] as const

export const MODEL_EVALUATION = {
  algorithm: 'XGBoost Regressor (XGBRegressor)',
  modelPath: 'models/delay_predictor.pkl',
  datasetPath: 'data/construction_tasks.csv',
  targetVariable: 'actual_duration',
  targetUnits: 'days',
  totalRecords: 6000,
  trainRecords: 4800,
  testRecords: 1200,
  hyperparameters: {
    nEstimators: 300,
    maxDepth: 6,
    learningRate: 0.1,
  },
  metrics: {
    maeDays: 1.0081,
    rmseDays: 1.2768,
    r2Score: 0.9744,
    r2Percent: 97.44,
  },
} as const

export interface GlobalShapFeature {
  feature: string
  label: string
  meanAbsShapDays: number
  explanation: string
}

// Verified directly via explain.py TreeExplainer on models/delay_predictor.pkl (baseline = 15.64 days)
export const SHAP_BASELINE_DAYS = 15.64

export const GLOBAL_SHAP_IMPORTANCE: GlobalShapFeature[] = [
  {
    feature: 'planned_duration',
    label: 'Planned Duration',
    meanAbsShapDays: 5.6783,
    explanation: 'Primary baseline driver determining overall task length.',
  },
  {
    feature: 'weather_risk',
    label: 'Weather Risk (1–5)',
    meanAbsShapDays: 1.1872,
    explanation: 'Strongest delay multiplier; higher risk adds outdoor overrun days.',
  },
  {
    feature: 'complexity_level',
    label: 'Complexity Level (1–10)',
    meanAbsShapDays: 0.829,
    explanation: 'Engineering complexity shifts predicted duration upward on tough spans.',
  },
  {
    feature: 'contractor_code',
    label: 'Contractor',
    meanAbsShapDays: 0.6214,
    explanation: 'Captures historical contractor execution-speed differences in training data.',
  },
  {
    feature: 'material_cost',
    label: 'Material Cost (USD)',
    meanAbsShapDays: 0.4888,
    explanation: 'Reflects material scale and procurement scope.',
  },
  {
    feature: 'task_type_code',
    label: 'Task Type',
    meanAbsShapDays: 0.3563,
    explanation: 'Distinguishes heavy structural stages from short inspection tasks.',
  },
  {
    feature: 'crew_size',
    label: 'Crew Size',
    meanAbsShapDays: 0.2149,
    explanation: 'Larger crews provide modest schedule-compression adjustments.',
  },
]

export interface PredictionPreset {
  id: string
  label: string
  payload: PredictionRequestPayload
}

export const PREDICTION_PRESETS: PredictionPreset[] = [
  {
    id: 'row-1',
    label: 'Dataset Row 1 (Excavation)',
    payload: {
      task_type: 'Excavation',
      contractor: 'Apex Builders',
      planned_duration: 9,
      crew_size: 15,
      material_cost: 59161.84,
      weather_risk: 2,
      complexity_level: 5,
    },
  },
  {
    id: 'high-risk-deck',
    label: 'High Weather Risk Decking',
    payload: {
      task_type: 'Bridge Decking',
      contractor: 'Titan Infrastructure',
      planned_duration: 20,
      crew_size: 14,
      material_cost: 145000,
      weather_risk: 5,
      complexity_level: 9,
    },
  },
]
