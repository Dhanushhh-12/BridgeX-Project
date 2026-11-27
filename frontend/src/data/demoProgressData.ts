import type { PredictionRequestPayload } from '../types/api'

/**
 * SYNTHETIC DATASET BENCHMARKS + ISOLATED DEMO TASK PROGRESS DATA
 * -------------------------------------------------------------------------
 * 1) CSV_STAGE_BENCHMARKS holds verified aggregate averages observed directly
 *    from data/construction_tasks.csv (6,000 synthetic records).
 * 2) DEMO_CONSTRUCTION_TASKS holds sample task monitoring rows mapped to
 *    DEMO_PROJECTS because FastAPI has no /tasks or /progress GET endpoints yet.
 *
 * Neither dataset claims to represent live real-world construction measurements.
 */

export type ConstructionStageName =
  | 'Site Preparation'
  | 'Excavation'
  | 'Foundation Piling'
  | 'Concrete Pouring'
  | 'Steel Erection'
  | 'Bridge Decking'
  | 'Asphalt Paving'
  | 'Structural Inspection'

export type TaskMonitoringStatus = 'Completed' | 'In Progress' | 'Pending' | 'Delayed'

export interface CsvStageBenchmark {
  stage: ConstructionStageName
  sequenceOrder: number
  csvRecordCount: number
  csvMeanPlannedDays: number
  csvMeanActualDays: number
}

export interface DemoTaskProgressRecord {
  id: string
  taskCode: string
  taskName: string
  projectId: string
  projectName: string
  category: ConstructionStageName
  plannedStartDate: string | null
  plannedDurationDays: number
  actualDurationDays: number | null
  currentProgressPct: number
  plannedProgressPct: number
  status: TaskMonitoringStatus
  contractor: string
  reportingPeriod: '7d' | '14d' | '30d'
  projectStatus: 'Active' | 'At Risk' | 'Completed'
  mlInput: PredictionRequestPayload
}

// Verified directly from C:\bridgeX\data\construction_tasks.csv (6,000 synthetic rows)
export const CSV_STAGE_BENCHMARKS: CsvStageBenchmark[] = [
  { stage: 'Site Preparation', sequenceOrder: 1, csvRecordCount: 746, csvMeanPlannedDays: 8.53, csvMeanActualDays: 10.88 },
  { stage: 'Excavation', sequenceOrder: 2, csvRecordCount: 747, csvMeanPlannedDays: 12.44, csvMeanActualDays: 14.69 },
  { stage: 'Foundation Piling', sequenceOrder: 3, csvRecordCount: 749, csvMeanPlannedDays: 19.68, csvMeanActualDays: 21.85 },
  { stage: 'Concrete Pouring', sequenceOrder: 4, csvRecordCount: 749, csvMeanPlannedDays: 13.74, csvMeanActualDays: 15.93 },
  { stage: 'Steel Erection', sequenceOrder: 5, csvRecordCount: 778, csvMeanPlannedDays: 24.33, csvMeanActualDays: 26.41 },
  { stage: 'Bridge Decking', sequenceOrder: 6, csvRecordCount: 737, csvMeanPlannedDays: 17.45, csvMeanActualDays: 19.57 },
  { stage: 'Asphalt Paving', sequenceOrder: 7, csvRecordCount: 733, csvMeanPlannedDays: 7.03, csvMeanActualDays: 9.15 },
  { stage: 'Structural Inspection', sequenceOrder: 8, csvRecordCount: 761, csvMeanPlannedDays: 3.98, csvMeanActualDays: 6.23 },
]

export const DEMO_CONSTRUCTION_TASKS: DemoTaskProgressRecord[] = [
  {
    id: 'task-demo-1',
    taskCode: 'TSK-0001',
    taskName: 'North Abutment Site Clearing (Demo)',
    projectId: 'demo-proj-1',
    projectName: 'Musi River Arch Span (Demo)',
    category: 'Site Preparation',
    plannedStartDate: null,
    plannedDurationDays: 8,
    actualDurationDays: 9.2,
    currentProgressPct: 100,
    plannedProgressPct: 100,
    status: 'Completed',
    contractor: 'Apex Builders',
    reportingPeriod: '30d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Site Preparation',
      contractor: 'Apex Builders',
      planned_duration: 8,
      crew_size: 6,
      material_cost: 20266.29,
      weather_risk: 2,
      complexity_level: 4,
    },
  },
  {
    id: 'task-demo-2',
    taskCode: 'TSK-0002',
    taskName: 'Riverbank Trench Excavation (Demo)',
    projectId: 'demo-proj-1',
    projectName: 'Musi River Arch Span (Demo)',
    category: 'Excavation',
    plannedStartDate: null,
    plannedDurationDays: 9,
    actualDurationDays: 10.7,
    currentProgressPct: 85,
    plannedProgressPct: 90,
    status: 'Delayed',
    contractor: 'Apex Builders',
    reportingPeriod: '7d',
    projectStatus: 'Active',
    mlInput: {
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
    id: 'task-demo-3',
    taskCode: 'TSK-0003',
    taskName: 'Main Pier Borehole Piling (Demo)',
    projectId: 'demo-proj-1',
    projectName: 'Musi River Arch Span (Demo)',
    category: 'Foundation Piling',
    plannedStartDate: null,
    plannedDurationDays: 18,
    actualDurationDays: null,
    currentProgressPct: 48,
    plannedProgressPct: 50,
    status: 'In Progress',
    contractor: 'Titan Infrastructure',
    reportingPeriod: '7d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Foundation Piling',
      contractor: 'Titan Infrastructure',
      planned_duration: 18,
      crew_size: 13,
      material_cost: 165345.38,
      weather_risk: 2,
      complexity_level: 4,
    },
  },
  {
    id: 'task-demo-4',
    taskCode: 'TSK-0004',
    taskName: 'South Span Deck Formwork & Pour (Demo)',
    projectId: 'demo-proj-2',
    projectName: 'Krishna Deck Viaduct (Demo)',
    category: 'Bridge Decking',
    plannedStartDate: null,
    plannedDurationDays: 20,
    actualDurationDays: 24.5,
    currentProgressPct: 45,
    plannedProgressPct: 65,
    status: 'Delayed',
    contractor: 'Titan Infrastructure',
    reportingPeriod: '7d',
    projectStatus: 'At Risk',
    mlInput: {
      task_type: 'Bridge Decking',
      contractor: 'Titan Infrastructure',
      planned_duration: 20,
      crew_size: 14,
      material_cost: 145000,
      weather_risk: 4,
      complexity_level: 8,
    },
  },
  {
    id: 'task-demo-5',
    taskCode: 'TSK-0005',
    taskName: 'Viaduct Wearing Course Paving (Demo)',
    projectId: 'demo-proj-2',
    projectName: 'Krishna Deck Viaduct (Demo)',
    category: 'Asphalt Paving',
    plannedStartDate: null,
    plannedDurationDays: 6,
    actualDurationDays: null,
    currentProgressPct: 0,
    plannedProgressPct: 10,
    status: 'Pending',
    contractor: 'BridgeCore Engineering',
    reportingPeriod: '14d',
    projectStatus: 'At Risk',
    mlInput: {
      task_type: 'Asphalt Paving',
      contractor: 'BridgeCore Engineering',
      planned_duration: 6,
      crew_size: 17,
      material_cost: 84759.7,
      weather_risk: 5,
      complexity_level: 8,
    },
  },
  {
    id: 'task-demo-6',
    taskCode: 'TSK-0006',
    taskName: 'Pier Cap Concrete Curing (Demo)',
    projectId: 'demo-proj-3',
    projectName: 'Godavari Pier Rehab (Demo)',
    category: 'Concrete Pouring',
    plannedStartDate: null,
    plannedDurationDays: 15,
    actualDurationDays: 12.8,
    currentProgressPct: 100,
    plannedProgressPct: 100,
    status: 'Completed',
    contractor: 'Apex Builders',
    reportingPeriod: '14d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Concrete Pouring',
      contractor: 'Apex Builders',
      planned_duration: 15,
      crew_size: 22,
      material_cost: 107316.91,
      weather_risk: 2,
      complexity_level: 1,
    },
  },
  {
    id: 'task-demo-7',
    taskCode: 'TSK-0007',
    taskName: 'Cross-Girder Concrete Jacket (Demo)',
    projectId: 'demo-proj-3',
    projectName: 'Godavari Pier Rehab (Demo)',
    category: 'Concrete Pouring',
    plannedStartDate: null,
    plannedDurationDays: 11,
    actualDurationDays: null,
    currentProgressPct: 62,
    plannedProgressPct: 60,
    status: 'In Progress',
    contractor: 'MetroStruct Ltd',
    reportingPeriod: '14d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Concrete Pouring',
      contractor: 'MetroStruct Ltd',
      planned_duration: 11,
      crew_size: 15,
      material_cost: 69045.15,
      weather_risk: 1,
      complexity_level: 2,
    },
  },
  {
    id: 'task-demo-8',
    taskCode: 'TSK-0008',
    taskName: 'Final Load & Structural Sign-Off (Demo)',
    projectId: 'demo-proj-4',
    projectName: 'Outer Ring Overpass (Demo)',
    category: 'Structural Inspection',
    plannedStartDate: null,
    plannedDurationDays: 4,
    actualDurationDays: 4.0,
    currentProgressPct: 100,
    plannedProgressPct: 100,
    status: 'Completed',
    contractor: 'Summit Civil Works',
    reportingPeriod: '30d',
    projectStatus: 'Completed',
    mlInput: {
      task_type: 'Structural Inspection',
      contractor: 'Summit Civil Works',
      planned_duration: 4,
      crew_size: 6,
      material_cost: 12000,
      weather_risk: 1,
      complexity_level: 3,
    },
  },
  {
    id: 'task-demo-9',
    taskCode: 'TSK-0009',
    taskName: 'Box Girder Steel Erection Span B (Demo)',
    projectId: 'demo-proj-5',
    projectName: 'Hussain Sagar Steel Flyover (Demo)',
    category: 'Steel Erection',
    plannedStartDate: null,
    plannedDurationDays: 24,
    actualDurationDays: 27.6,
    currentProgressPct: 39,
    plannedProgressPct: 55,
    status: 'Delayed',
    contractor: 'MetroStruct Ltd',
    reportingPeriod: '14d',
    projectStatus: 'At Risk',
    mlInput: {
      task_type: 'Steel Erection',
      contractor: 'MetroStruct Ltd',
      planned_duration: 24,
      crew_size: 22,
      material_cost: 185000,
      weather_risk: 3,
      complexity_level: 9,
    },
  },
  {
    id: 'task-demo-10',
    taskCode: 'TSK-0010',
    taskName: 'Approach Ramp Pile Cap Layout (Demo)',
    projectId: 'demo-proj-6',
    projectName: 'Amaravati Cable Approaches (Demo)',
    category: 'Foundation Piling',
    plannedStartDate: null,
    plannedDurationDays: 18,
    actualDurationDays: null,
    currentProgressPct: 41,
    plannedProgressPct: 42,
    status: 'In Progress',
    contractor: 'BridgeCore Engineering',
    reportingPeriod: '30d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Foundation Piling',
      contractor: 'BridgeCore Engineering',
      planned_duration: 18,
      crew_size: 18,
      material_cost: 132000,
      weather_risk: 2,
      complexity_level: 7,
    },
  },
  {
    id: 'task-demo-11',
    taskCode: 'TSK-0011',
    taskName: 'Delta Link Asphalt Resurfacing (Demo)',
    projectId: 'demo-proj-7',
    projectName: 'Kovvur Approach Resurfacing (Demo)',
    category: 'Asphalt Paving',
    plannedStartDate: null,
    plannedDurationDays: 7,
    actualDurationDays: 6.8,
    currentProgressPct: 100,
    plannedProgressPct: 100,
    status: 'Completed',
    contractor: 'Apex Builders',
    reportingPeriod: '30d',
    projectStatus: 'Completed',
    mlInput: {
      task_type: 'Asphalt Paving',
      contractor: 'Apex Builders',
      planned_duration: 7,
      crew_size: 12,
      material_cost: 54000,
      weather_risk: 1,
      complexity_level: 4,
    },
  },
  {
    id: 'task-demo-12',
    taskCode: 'TSK-0012',
    taskName: 'Post-Paving Bearing Inspection (Demo)',
    projectId: 'demo-proj-6',
    projectName: 'Amaravati Cable Approaches (Demo)',
    category: 'Structural Inspection',
    plannedStartDate: null,
    plannedDurationDays: 4,
    actualDurationDays: null,
    currentProgressPct: 0,
    plannedProgressPct: 0,
    status: 'Pending',
    contractor: 'Summit Civil Works',
    reportingPeriod: '30d',
    projectStatus: 'Active',
    mlInput: {
      task_type: 'Structural Inspection',
      contractor: 'Summit Civil Works',
      planned_duration: 4,
      crew_size: 5,
      material_cost: 9500,
      weather_risk: 1,
      complexity_level: 3,
    },
  },
]
