/**
 * VERIFIED ANALYTICS DATA SOURCES (SYNTHETIC CSV + HELD-OUT ML TEST + SAVED CV CSV)
 * ---------------------------------------------------------------------------------
 * All numeric arrays in this module come directly from inspected project files:
 *   1. data/construction_tasks.csv (6,000 synthetic tasks grouped by contractor & task_type)
 *   2. models/delay_predictor.pkl evaluated on train.py's 20% test split (seed 42)
 *   3. data/images/reports/*.csv saved CV comparison outputs
 *
 * Strictly separate from DEMO_PROJECTS / DEMO_CONSTRUCTION_TASKS and live FastAPI calls.
 */

export interface ContractorAnalyticsRow {
  contractor: string
  taskCount: number
  meanPlannedDays: number
  meanActualDays: number
  meanOverrunDays: number
}

// Verified directly from C:\bridgeX\data\construction_tasks.csv (6,000 synthetic rows)
export const CSV_CONTRACTOR_ANALYTICS: ContractorAnalyticsRow[] = [
  {
    contractor: 'BridgeCore Engineering',
    taskCount: 1175,
    meanPlannedDays: 13.49,
    meanActualDays: 14.59,
    meanOverrunDays: 1.1,
  },
  {
    contractor: 'Apex Builders',
    taskCount: 1222,
    meanPlannedDays: 13.22,
    meanActualDays: 14.83,
    meanOverrunDays: 1.61,
  },
  {
    contractor: 'Summit Civil Works',
    taskCount: 1220,
    meanPlannedDays: 13.34,
    meanActualDays: 15.49,
    meanOverrunDays: 2.16,
  },
  {
    contractor: 'MetroStruct Ltd',
    taskCount: 1223,
    meanPlannedDays: 13.6,
    meanActualDays: 16.29,
    meanOverrunDays: 2.69,
  },
  {
    contractor: 'Titan Infrastructure',
    taskCount: 1160,
    meanPlannedDays: 13.57,
    meanActualDays: 16.99,
    meanOverrunDays: 3.41,
  },
]

export interface HeldOutPredictionPoint {
  sampleIndex: number
  taskId: number
  taskType: string
  recordedActualDays: number
  predictedActualDays: number
  errorDays: number
}

// First 10 held-out test records from train.py (test_size=0.2, random_state=42)
export const HELD_OUT_ML_SAMPLES: HeldOutPredictionPoint[] = [
  { sampleIndex: 1, taskId: 1782, taskType: 'Foundation Piling', recordedActualDays: 28.0, predictedActualDays: 25.3, errorDays: -2.7 },
  { sampleIndex: 2, taskId: 3917, taskType: 'Excavation', recordedActualDays: 16.2, predictedActualDays: 16.0, errorDays: -0.2 },
  { sampleIndex: 3, taskId: 221, taskType: 'Steel Erection', recordedActualDays: 31.6, predictedActualDays: 31.0, errorDays: -0.6 },
  { sampleIndex: 4, taskId: 2135, taskType: 'Structural Inspection', recordedActualDays: 8.0, predictedActualDays: 6.6, errorDays: -1.4 },
  { sampleIndex: 5, taskId: 5224, taskType: 'Structural Inspection', recordedActualDays: 6.1, predictedActualDays: 4.9, errorDays: -1.2 },
  { sampleIndex: 6, taskId: 1168, taskType: 'Bridge Decking', recordedActualDays: 19.8, predictedActualDays: 20.5, errorDays: 0.7 },
  { sampleIndex: 7, taskId: 879, taskType: 'Concrete Pouring', recordedActualDays: 13.4, predictedActualDays: 13.6, errorDays: 0.2 },
  { sampleIndex: 8, taskId: 156, taskType: 'Site Preparation', recordedActualDays: 12.8, predictedActualDays: 13.8, errorDays: 1.0 },
  { sampleIndex: 9, taskId: 1657, taskType: 'Concrete Pouring', recordedActualDays: 17.4, predictedActualDays: 17.0, errorDays: -0.4 },
  { sampleIndex: 10, taskId: 323, taskType: 'Concrete Pouring', recordedActualDays: 7.4, predictedActualDays: 7.2, errorDays: -0.2 },
]

export interface SavedCvReportSummary {
  id: string
  reportName: string
  recordedAt: string
  photoPairLabel: string
  imageDiffScorePct: number
  rawChangedPixelsPct: number
  semanticRegionChangePct: number
  visibleChangesSummary: string
  validationStatus: string
}

// Verified from C:\bridgeX\data\images\reports\*.csv and file modified timestamps
export const SAVED_CV_REPORTS: SavedCvReportSummary[] = [
  {
    id: 'cv-rep-3',
    reportName: 'api_progress_prog_1e48ac275a07.csv',
    recordedAt: '2026-11-27 13:12',
    photoPairLabel: 'prog_1e48ac275a07_previous.jpg -> prog_1e48ac275a07_current.jpg',
    imageDiffScorePct: 22.9,
    rawChangedPixelsPct: 74.32,
    semanticRegionChangePct: 60.93,
    visibleChangesSummary: 'wall (0.0% -> 29.8%); road (28.1% -> 0.0%); car (18.1% -> 0.0%)',
    validationStatus: 'Pending engineer review',
  },
  {
    id: 'cv-rep-2',
    reportName: 'api_progress_prog_12f28617c471.csv',
    recordedAt: '2026-11-27 13:11',
    photoPairLabel: 'prog_12f28617c471_previous.jpg -> prog_12f28617c471_current.jpg',
    imageDiffScorePct: 22.9,
    rawChangedPixelsPct: 74.32,
    semanticRegionChangePct: 60.93,
    visibleChangesSummary: 'wall (0.0% -> 29.8%); road (28.1% -> 0.0%); car (18.1% -> 0.0%)',
    validationStatus: 'Pending engineer review',
  },
  {
    id: 'cv-rep-1',
    reportName: 'progress_analysis_report.csv',
    recordedAt: '2026-11-26 22:38',
    photoPairLabel: 'download.jfif -> pexels-dominik-257777306-14668116.jpg',
    imageDiffScorePct: 22.9,
    rawChangedPixelsPct: 74.32,
    semanticRegionChangePct: 60.93,
    visibleChangesSummary: 'wall (0.0% -> 29.8%); road (28.1% -> 0.0%); car (18.1% -> 0.0%)',
    validationStatus: 'Pending engineer review',
  },
]
