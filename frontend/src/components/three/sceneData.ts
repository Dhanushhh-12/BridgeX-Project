import type { BackendTaskRecord, ManagedProjectRecord } from '../../types/api'

export type InfrastructureZoneId =
  | 'site-prep'
  | 'excavation'
  | 'piling'
  | 'concrete'
  | 'steel'
  | 'decking'
  | 'paving'
  | 'inspection'

export type ZoneVisualState = 'completed' | 'active' | 'at-risk' | 'pending'

export interface InfrastructureZoneMeta {
  id: InfrastructureZoneId
  stageName: string
  order: number
  structuralPart: string
  description: string
  focusTarget: [number, number, number]
  cameraPosition: [number, number, number]
}

export interface ResolvedInfrastructureZone extends InfrastructureZoneMeta {
  progressPct: number
  plannedPct: number | null
  visualState: ZoneVisualState
  dataSourceLabel: 'Logged Task Record' | 'Derived from Project %'
  matchedTasks: BackendTaskRecord[]
  contractor: string | null
  weatherRisk: number | null
  complexityLevel: number | null
}

export const DESIGN_PALETTE_HEX = {
  ivory: '#F5F0E6',
  blue: '#183153',
  coral: '#F0785F',
  sand: '#E8DFD0',
  charcoal: '#292D32',
  sage: '#8B9B91',
  white: '#FFFFFF',
  border: '#DED7CB',
  river: '#AFC0C6',
} as const

export const INFRASTRUCTURE_ZONES: InfrastructureZoneMeta[] = [
  {
    id: 'site-prep',
    stageName: 'Site Preparation',
    order: 1,
    structuralPart: 'Staging Yard & Abutment Pads',
    description: 'Corridor clearing, survey control monuments, and approach staging pads.',
    focusTarget: [-8.2, 0.4, 0],
    cameraPosition: [-12.5, 5.4, 9.5],
  },
  {
    id: 'excavation',
    stageName: 'Excavation',
    order: 2,
    structuralPart: 'Bank Trenches & Cofferdams',
    description: 'Riverbank earthworks, pier footing cuts, and protective cofferdam walls.',
    focusTarget: [-4.5, -0.35, 0],
    cameraPosition: [-8.5, 4.8, 8.8],
  },
  {
    id: 'piling',
    stageName: 'Foundation Piling',
    order: 3,
    structuralPart: 'Deep Caissons & Pile Caps',
    description: 'Driven structural piles seated below scour depth with reinforced pile caps.',
    focusTarget: [-3.2, -0.5, 0],
    cameraPosition: [-5.5, 3.6, 8.6],
  },
  {
    id: 'concrete',
    stageName: 'Concrete Pouring',
    order: 4,
    structuralPart: 'Main Piers & Crossheads',
    description: 'Cast-in-place pier shafts, bearings pedestals, and hammerhead crossheads.',
    focusTarget: [0, 1.3, 0],
    cameraPosition: [4.2, 4.4, 9.4],
  },
  {
    id: 'steel',
    stageName: 'Steel Erection',
    order: 5,
    structuralPart: 'Arch Ribs / Structural Girders',
    description: 'Primary load-bearing steel arches, box girders, and vertical tension hangers.',
    focusTarget: [0, 3.4, 0],
    cameraPosition: [5.5, 5.8, 10.8],
  },
  {
    id: 'decking',
    stageName: 'Bridge Decking',
    order: 6,
    structuralPart: 'Precast Concrete Deck Slab',
    description: 'Composite deck slab panels spanning main piers and approach abutments.',
    focusTarget: [0, 2.25, 0],
    cameraPosition: [7.5, 5.2, 9.5],
  },
  {
    id: 'paving',
    stageName: 'Asphalt Paving',
    order: 7,
    structuralPart: 'Carriageway & Approach Surfacing',
    description: 'Two-lane wearing course, lane markings, and expansion-joint transitions.',
    focusTarget: [5.2, 2.35, 0],
    cameraPosition: [11.2, 5.8, 8.5],
  },
  {
    id: 'inspection',
    stageName: 'Structural Inspection',
    order: 8,
    structuralPart: 'Safety Parapets & Telemetry Sensors',
    description: 'Edge barriers, structural health monitoring nodes, and final load verification.',
    focusTarget: [2.2, 2.75, 1.45],
    cameraPosition: [7.2, 4.9, 8.4],
  },
]

export type CameraPresetKey = 'overview' | 'substructure' | 'superstructure'
export type SceneMode = 'infrastructure' | 'globe'

export interface CameraCommand {
  nonce: number
  kind: 'preset' | 'focus' | 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight'
  position?: [number, number, number]
  target?: [number, number, number]
}

export const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  overview: {
    label: 'Corridor Overview',
    position: [13.5, 8.2, 13.5],
    target: [0, 1.5, 0],
  },
  substructure: {
    label: 'Substructure & Piers',
    position: [-7.5, 3.8, 9.5],
    target: [-1.5, 0.3, 0],
  },
  superstructure: {
    label: 'Deck & Steel Span',
    position: [6.8, 5.6, 9.8],
    target: [0, 2.8, 0],
  },
}

export function getPresetCamera(
  mode: SceneMode,
  preset: CameraPresetKey,
): {
  position: [number, number, number]
  target: [number, number, number]
} {
  if (mode === 'globe') {
    return {
      position: [0, 2.2, 8.6],
      target: [0, 0, 0],
    }
  }
  return {
    position: CAMERA_PRESETS[preset].position,
    target: CAMERA_PRESETS[preset].target,
  }
}

/**
 * Resolves each of the 8 canonical construction stages for a project using
 * actual logged SQLite tasks first, or an explicit proportional derivation from
 * the persisted project `actual_progress_pct` when no stage task is logged yet.
 */
export function resolveProjectInfrastructureZones(
  project: ManagedProjectRecord | null,
  tasks: BackendTaskRecord[],
): ResolvedInfrastructureZone[] {
  const projectProgress = project ? Math.max(0, Math.min(100, project.actual_progress_pct)) : 0
  const isProjectAtRisk = project?.status === 'At Risk'
  const isProjectCompleted = project?.status === 'Completed'

  return INFRASTRUCTURE_ZONES.map((zone, idx) => {
    const matching = tasks.filter(
      (t) => t.category.trim().toLowerCase() === zone.stageName.toLowerCase(),
    )

    if (matching.length > 0) {
      const avgActual =
        matching.reduce((sum, t) => sum + Number(t.actual_progress_pct || 0), 0) / matching.length
      const avgPlanned =
        matching.reduce((sum, t) => sum + Number(t.planned_progress_pct || 0), 0) / matching.length
      const hasDelayed = matching.some((t) => t.status === 'Delayed')
      const allCompleted = matching.every((t) => t.status === 'Completed' || t.actual_progress_pct >= 100)
      const hasInProgress = matching.some((t) => t.status === 'In Progress')

      let visualState: ZoneVisualState = 'pending'
      if (allCompleted) {
        visualState = 'completed'
      } else if (hasDelayed || (isProjectAtRisk && avgActual < avgPlanned)) {
        visualState = 'at-risk'
      } else if (hasInProgress || avgActual > 0) {
        visualState = 'active'
      }

      return {
        ...zone,
        progressPct: Math.round(avgActual * 10) / 10,
        plannedPct: Math.round(avgPlanned * 10) / 10,
        visualState,
        dataSourceLabel: 'Logged Task Record',
        matchedTasks: matching,
        contractor: matching[0]?.contractor ?? null,
        weatherRisk: matching[0]?.weather_risk ?? null,
        complexityLevel: matching[0]?.complexity_level ?? null,
      }
    }

    // No task logged specifically for this stage: derive proportional stage position
    // transparently from the project's persisted actual_progress_pct.
    const bandSize = 100 / INFRASTRUCTURE_ZONES.length
    const bandStart = idx * bandSize
    const bandEnd = (idx + 1) * bandSize

    let derivedPct = 0
    if (isProjectCompleted || projectProgress >= bandEnd) {
      derivedPct = 100
    } else if (projectProgress > bandStart) {
      derivedPct = Math.round(((projectProgress - bandStart) / bandSize) * 100)
    }

    let visualState: ZoneVisualState = 'pending'
    if (derivedPct >= 100) {
      visualState = 'completed'
    } else if (derivedPct > 0) {
      visualState = isProjectAtRisk ? 'at-risk' : 'active'
    }

    return {
      ...zone,
      progressPct: derivedPct,
      plannedPct: project ? Math.round(project.planned_progress_pct) : null,
      visualState,
      dataSourceLabel: 'Derived from Project %',
      matchedTasks: [],
      contractor: null,
      weatherRisk: null,
      complexityLevel: null,
    }
  })
}

export function getZoneColor(state: ZoneVisualState, fallbackHex?: string): string {
  if (state === 'completed') return DESIGN_PALETTE_HEX.sage
  if (state === 'at-risk') return DESIGN_PALETTE_HEX.coral
  if (state === 'active') return DESIGN_PALETTE_HEX.blue
  return fallbackHex || DESIGN_PALETTE_HEX.sand
}

export function getZoneStateLabel(state: ZoneVisualState): string {
  if (state === 'completed') return 'Completed'
  if (state === 'at-risk') return 'At Risk / Delayed'
  if (state === 'active') return 'In Progress'
  return 'Pending'
}

/**
 * Converts geographic latitude/longitude (degrees) to 3D Cartesian coordinates
 * on a sphere of given radius (matching standard Three.js SphereGeometry UV mapping).
 */
export function latLonToSpherePosition(
  latitude: number,
  longitude: number,
  radius: number,
): [number, number, number] {
  const phi = (90 - latitude) * (Math.PI / 180)
  const theta = (longitude + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return [x, y, z]
}
