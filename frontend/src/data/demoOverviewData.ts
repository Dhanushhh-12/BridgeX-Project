import type { PredictionRequestPayload } from '../types/api'

/**
 * STRICTLY ISOLATED DEMO DATA
 * ---------------------------
 * These records are placeholder portfolio rows because FastAPI does not
 * yet expose /projects, /tasks, or /activity persistence endpoints.
 * Every UI surface displaying this data MUST carry an explicit DEMO DATA label.
 */

export type DemoProjectStatus = 'Active' | 'At Risk' | 'Completed'
export type DemoProjectType =
  | 'Arch Bridge'
  | 'Viaduct Deck'
  | 'Pier Rehabilitation'
  | 'Highway Overpass'

export interface DemoProjectRecord {
  id: string
  projectCode: string
  name: string
  projectType: DemoProjectType
  location: string
  corridor: string
  manager: string | null
  startDate: string
  expectedCompletion: string
  description: string
  status: DemoProjectStatus
  reportingPeriod: '7d' | '14d' | '30d'
  plannedProgressPct: number
  actualProgressPct: number
  latitude: number
  longitude: number
  benchmarkTask: PredictionRequestPayload
}

export interface DemoActivityRecord {
  id: string
  projectId: string
  projectOrTask: string
  description: string
  status: DemoProjectStatus
  date: string
  source: string
  reportingPeriod: '7d' | '14d' | '30d'
}

export const DEMO_PROJECTS: DemoProjectRecord[] = [
  {
    id: 'demo-proj-1',
    projectCode: 'BX-DEMO-001',
    name: 'Musi River Arch Span (Demo)',
    projectType: 'Arch Bridge',
    location: 'Hyderabad',
    corridor: 'Hyderabad Corridor — Demo Portfolio',
    manager: null,
    startDate: '2026-02-10',
    expectedCompletion: '2026-12-20',
    description:
      'Sample twin-arch river crossing project used to preview infrastructure tracking and ML task benchmarking.',
    status: 'Active',
    reportingPeriod: '7d',
    plannedProgressPct: 68,
    actualProgressPct: 64,
    latitude: 17.385,
    longitude: 78.4867,
    benchmarkTask: {
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
    id: 'demo-proj-2',
    projectCode: 'BX-DEMO-002',
    name: 'Krishna Deck Viaduct (Demo)',
    projectType: 'Viaduct Deck',
    location: 'Vijayawada',
    corridor: 'Southern Highway — Demo Portfolio',
    manager: null,
    startDate: '2026-03-01',
    expectedCompletion: '2027-03-15',
    description:
      'Sample multi-span concrete viaduct segment marked attention-required for outdoor weather sensitivity.',
    status: 'At Risk',
    reportingPeriod: '7d',
    plannedProgressPct: 58,
    actualProgressPct: 45,
    latitude: 16.5062,
    longitude: 80.648,
    benchmarkTask: {
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
    id: 'demo-proj-3',
    projectCode: 'BX-DEMO-003',
    name: 'Godavari Pier Rehab (Demo)',
    projectType: 'Pier Rehabilitation',
    location: 'Rajahmundry',
    corridor: 'Coastal Link — Demo Portfolio',
    manager: null,
    startDate: '2026-01-18',
    expectedCompletion: '2026-11-30',
    description:
      'Sample substructure concrete pier strengthening package with favorable progress alignment.',
    status: 'Active',
    reportingPeriod: '14d',
    plannedProgressPct: 74,
    actualProgressPct: 76,
    latitude: 17.0005,
    longitude: 81.804,
    benchmarkTask: {
      task_type: 'Concrete Pouring',
      contractor: 'BridgeCore Engineering',
      planned_duration: 14,
      crew_size: 20,
      material_cost: 92500,
      weather_risk: 2,
      complexity_level: 6,
    },
  },
  {
    id: 'demo-proj-4',
    projectCode: 'BX-DEMO-004',
    name: 'Outer Ring Overpass (Demo)',
    projectType: 'Highway Overpass',
    location: 'Hyderabad',
    corridor: 'Metro Beltway — Demo Portfolio',
    manager: null,
    startDate: '2025-11-05',
    expectedCompletion: '2026-09-12',
    description:
      'Sample grade-separated urban highway overpass demonstrating completed inspection workflow.',
    status: 'Completed',
    reportingPeriod: '30d',
    plannedProgressPct: 100,
    actualProgressPct: 100,
    latitude: 17.4401,
    longitude: 78.3489,
    benchmarkTask: {
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
    id: 'demo-proj-5',
    projectCode: 'BX-DEMO-005',
    name: 'Hussain Sagar Steel Flyover (Demo)',
    projectType: 'Highway Overpass',
    location: 'Secunderabad',
    corridor: 'Central Urban Arterial — Demo Portfolio',
    manager: null,
    startDate: '2026-04-12',
    expectedCompletion: '2027-05-01',
    description:
      'Sample structural steel girder erection corridor flagged for complex urban staging constraints.',
    status: 'At Risk',
    reportingPeriod: '14d',
    plannedProgressPct: 49,
    actualProgressPct: 39,
    latitude: 17.4239,
    longitude: 78.4738,
    benchmarkTask: {
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
    id: 'demo-proj-6',
    projectCode: 'BX-DEMO-006',
    name: 'Amaravati Cable Approaches (Demo)',
    projectType: 'Viaduct Deck',
    location: 'Vijayawada',
    corridor: 'Riverfront Connector — Demo Portfolio',
    manager: null,
    startDate: '2026-05-20',
    expectedCompletion: '2027-06-30',
    description:
      'Sample approach ramp piling and asphalt wearing-course corridor for multi-page table verification.',
    status: 'Active',
    reportingPeriod: '30d',
    plannedProgressPct: 42,
    actualProgressPct: 41,
    latitude: 16.5193,
    longitude: 80.6305,
    benchmarkTask: {
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
    id: 'demo-proj-7',
    projectCode: 'BX-DEMO-007',
    name: 'Kovvur Approach Resurfacing (Demo)',
    projectType: 'Pier Rehabilitation',
    location: 'Rajahmundry',
    corridor: 'East Delta Link — Demo Portfolio',
    manager: null,
    startDate: '2025-09-14',
    expectedCompletion: '2026-06-18',
    description:
      'Sample completed pavement and expansion-joint rehabilitation package.',
    status: 'Completed',
    reportingPeriod: '30d',
    plannedProgressPct: 100,
    actualProgressPct: 100,
    latitude: 17.0112,
    longitude: 81.7279,
    benchmarkTask: {
      task_type: 'Asphalt Paving',
      contractor: 'Apex Builders',
      planned_duration: 7,
      crew_size: 12,
      material_cost: 54000,
      weather_risk: 1,
      complexity_level: 4,
    },
  },
]

export const DEMO_ACTIVITY: DemoActivityRecord[] = [
  {
    id: 'demo-act-1',
    projectId: 'demo-proj-1',
    projectOrTask: 'Musi River Arch Span — Excavation',
    description: 'Sample foundation trenching benchmark prepared for ML duration validation.',
    status: 'Active',
    date: 'Demo Period (7d)',
    source: 'DEMO DATA (Pending DB)',
    reportingPeriod: '7d',
  },
  {
    id: 'demo-act-2',
    projectId: 'demo-proj-2',
    projectOrTask: 'Krishna Deck Viaduct — Bridge Decking',
    description: 'High weather sensitivity flagged for outdoor deck curing inspection.',
    status: 'At Risk',
    date: 'Demo Period (7d)',
    source: 'DEMO DATA (Pending DB)',
    reportingPeriod: '7d',
  },
  {
    id: 'demo-act-3',
    projectId: 'demo-proj-3',
    projectOrTask: 'Godavari Pier Rehab — Concrete Pouring',
    description: 'Formwork alignment check completed ahead of planned baseline.',
    status: 'Active',
    date: 'Demo Period (14d)',
    source: 'DEMO DATA (Pending DB)',
    reportingPeriod: '14d',
  },
  {
    id: 'demo-act-4',
    projectId: 'demo-proj-4',
    projectOrTask: 'Outer Ring Overpass — Structural Inspection',
    description: 'Final sign-off checklist logged in demo portfolio archive.',
    status: 'Completed',
    date: 'Demo Period (30d)',
    source: 'DEMO DATA (Pending DB)',
    reportingPeriod: '30d',
  },
]
