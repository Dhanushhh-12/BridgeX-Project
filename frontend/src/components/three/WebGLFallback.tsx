import { AlertTriangle, CheckCircle2, Clock, Layers, MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ManagedProjectRecord } from '../../types/api'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'
import {
  getZoneColor,
  getZoneStateLabel,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
} from './sceneData'

export interface WebGLFallbackProps {
  reason: string | null
  project: ManagedProjectRecord | null
  zones: ResolvedInfrastructureZone[]
  selectedZoneId: InfrastructureZoneId | null
  onSelectZone: (zoneId: InfrastructureZoneId) => void
  onRetryWebGL?: () => void
  projectsWithCoords: Array<ManagedProjectRecord & { latitude: number; longitude: number }>
  onSelectProject?: (projectCode: string) => void
}

export function WebGLFallback({
  reason,
  project,
  zones,
  selectedZoneId,
  onSelectZone,
  onRetryWebGL,
  projectsWithCoords,
  onSelectProject,
}: WebGLFallbackProps) {
  const navigate = useNavigate()

  return (
    <Card className="border-border-neutral bg-surface">
      <CardHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">2D Schematic Fallback Active</Badge>
            <Badge variant="neutral">No WebGL Required</Badge>
          </div>
          <CardTitle className="mt-1.5">
            {project ? `${project.project_code} · ${project.name}` : 'Infrastructure Structural Schematic'}
          </CardTitle>
          <CardDescription>
            {reason ||
              'Interactive 2D engineering schematic preserving stage progress, risk signals, and corridor coordinates.'}
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRetryWebGL && (
            <Button type="button" variant="secondary" size="sm" onClick={onRetryWebGL}>
              Retry 3D View
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<MapPin className="h-3.5 w-3.5" />}
            onClick={() => navigate('/maps')}
          >
            Open 2D Map
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Enterprise 2D Elevation Diagram (SVG) */}
        <div className="overflow-x-auto rounded-sm border border-border-neutral bg-ivory/70 p-4">
          <svg
            viewBox="0 0 800 220"
            role="img"
            aria-label="2D bridge elevation schematic showing 8 construction stages"
            className="h-auto w-full min-w-[540px]"
          >
            {/* Sky & River Channel */}
            <rect x="0" y="0" width="800" height="220" fill="#F5F0E6" rx="4" />
            <rect x="200" y="168" width="400" height="36" fill="#AFC0C6" opacity="0.6" rx="2" />
            <rect x="20" y="158" width="185" height="46" fill="#E8DFD0" />
            <rect x="595" y="158" width="185" height="46" fill="#E8DFD0" />

            {/* Steel Arch / Superstructure */}
            <path
              d="M 210 112 Q 400 24 590 112"
              fill="none"
              stroke={getZoneColor(zones[4]?.visualState ?? 'pending', '#183153')}
              strokeWidth="10"
              strokeLinecap="round"
            />
            {[260, 315, 370, 430, 485, 540].map((xPos) => {
              const archY = 112 - 66 * Math.sin(((xPos - 210) / 380) * Math.PI)
              return (
                <line
                  key={xPos}
                  x1={xPos}
                  y1={archY}
                  x2={xPos}
                  y2={112}
                  stroke={getZoneColor(zones[4]?.visualState ?? 'pending', '#183153')}
                  strokeWidth="2.5"
                />
              )
            })}

            {/* Piers & Foundations */}
            {[220, 560].map((pierX) => (
              <g key={pierX}>
                <rect
                  x={pierX}
                  y={158}
                  width="24"
                  height="38"
                  fill={getZoneColor(zones[2]?.visualState ?? 'pending', '#8B9B91')}
                />
                <rect
                  x={pierX + 3}
                  y={116}
                  width="18"
                  height="42"
                  fill={getZoneColor(zones[3]?.visualState ?? 'pending', '#183153')}
                />
              </g>
            ))}

            {/* Deck & Asphalt */}
            <rect
              x="70"
              y="108"
              width="660"
              height="12"
              fill={getZoneColor(zones[5]?.visualState ?? 'pending', '#183153')}
              rx="2"
            />
            <rect
              x="70"
              y="102"
              width="660"
              height="6"
              fill={getZoneColor(zones[6]?.visualState ?? 'pending', '#292D32')}
              rx="1"
            />

            {/* Abutments / Site Prep */}
            <rect
              x="35"
              y="112"
              width="45"
              height="46"
              fill={getZoneColor(zones[0]?.visualState ?? 'pending', '#E8DFD0')}
            />
            <rect
              x="720"
              y="112"
              width="45"
              height="46"
              fill={getZoneColor(zones[0]?.visualState ?? 'pending', '#E8DFD0')}
            />

            {/* Labels */}
            <text x="40" y="26" fontSize="12" fontWeight="600" fill="#183153">
              2D Structural Elevation (Non-WebGL Fallback)
            </text>
            <text x="40" y="42" fontSize="10" fill="#292D32">
              {project
                ? `${project.project_code} · ${project.project_type} · ${project.actual_progress_pct}% Overall Progress`
                : 'Select a project to inspect stage breakdown'}
            </text>
          </svg>
        </div>

        {/* Accessible 8-stage interactive cards */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone) => {
            const isSelected = selectedZoneId === zone.id
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => onSelectZone(zone.id)}
                aria-pressed={isSelected}
                className={`flex flex-col justify-between rounded-sm border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-editorial-blue bg-sand/70 ring-1 ring-editorial-blue'
                    : 'border-border-neutral bg-ivory/40 hover:bg-sand/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-editorial-blue">
                    {zone.order}. {zone.stageName}
                  </span>
                  {zone.visualState === 'completed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sage" aria-hidden="true" />
                  ) : zone.visualState === 'at-risk' ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-coral" aria-hidden="true" />
                  ) : zone.visualState === 'active' ? (
                    <Layers className="h-3.5 w-3.5 shrink-0 text-editorial-blue" aria-hidden="true" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0 text-charcoal/50" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-charcoal/75">{zone.structuralPart}</p>
                <div className="mt-2 flex items-center justify-between text-xs font-medium">
                  <span className="text-charcoal/80">{getZoneStateLabel(zone.visualState)}</span>
                  <span className="bx-tabular font-mono font-semibold text-editorial-blue">
                    {zone.progressPct}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Corridor coordinates fallback */}
        {projectsWithCoords.length > 0 && (
          <div className="rounded-sm border border-border-neutral bg-ivory/40 p-3">
            <p className="bx-label mb-2">Persisted Corridor Coordinates ({projectsWithCoords.length})</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {projectsWithCoords.map((p) => (
                <button
                  key={p.project_code}
                  type="button"
                  onClick={() => onSelectProject?.(p.project_code)}
                  className="flex items-center justify-between rounded-sm border border-border-neutral bg-surface px-3 py-2 text-left text-xs hover:bg-sand/50"
                >
                  <div>
                    <span className="font-mono font-semibold text-editorial-blue">{p.project_code}</span>
                    <span className="ml-1.5 text-charcoal/80">{p.location}</span>
                  </div>
                  <span className="bx-tabular font-mono text-[11px] text-charcoal/70">
                    {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
