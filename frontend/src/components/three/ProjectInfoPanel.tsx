import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Compass,
  Database,
  Layers,
  MapPin,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getWeather } from '../../services/apiClient'
import type { ManagedProjectRecord, WeatherResponse } from '../../types/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingIndicator,
} from '../ui'
import {
  getZoneStateLabel,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
} from './sceneData'

export interface ProjectInfoPanelProps {
  project: ManagedProjectRecord | null
  zones: ResolvedInfrastructureZone[]
  selectedZone: ResolvedInfrastructureZone | null
  onSelectZone: (zoneId: InfrastructureZoneId) => void
  onFocusZone: (zoneId: InfrastructureZoneId) => void
}

function getStatusBadgeVariant(
  status: ManagedProjectRecord['status'],
): 'success' | 'warning' | 'info' {
  if (status === 'At Risk') return 'warning'
  if (status === 'Completed') return 'success'
  return 'info'
}

export function ProjectInfoPanel({
  project,
  zones,
  selectedZone,
  onSelectZone,
  onFocusZone,
}: ProjectInfoPanelProps) {
  const navigate = useNavigate()
  const [weatherState, setWeatherState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
  }>({ status: 'idle', data: null })

  useEffect(() => {
    if (!project || project.latitude === null || project.longitude === null) {
      Promise.resolve().then(() => setWeatherState({ status: 'idle', data: null }))
      return
    }

    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setWeatherState({ status: 'loading', data: null })
    })

    getWeather({
      latitude: project.latitude,
      longitude: project.longitude,
      days: 7,
      thresholdMm: 5.0,
    })
      .then((data) => {
        if (!cancelled) setWeatherState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setWeatherState({ status: 'error', data: null })
      })

    return () => {
      cancelled = true
    }
  }, [project])

  if (!project) {
    return (
      <Card className="flex h-full flex-col justify-center">
        <EmptyState
          icon={<Layers className="h-5 w-5 text-editorial-blue" />}
          title="No Project Selected"
          description="Select an infrastructure project from the corridor selector or click a marker on the 3D globe."
        />
      </Card>
    )
  }

  const variance = Math.round((project.actual_progress_pct - project.planned_progress_pct) * 10) / 10

  return (
    <Card className="flex h-full flex-col justify-between">
      <div>
        <CardHeader>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="bx-label">
                {project.project_code} · {project.project_type}
              </span>
              {project.is_demo_reference && <Badge variant="neutral">Seeded SQLite Record</Badge>}
            </div>
            <CardTitle className="mt-1 truncate">{project.name}</CardTitle>
            <CardDescription className="truncate">{project.corridor}</CardDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(project.status)}>{project.status}</Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Actual vs Planned Progress */}
          <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-editorial-blue">Overall Persisted Progress</span>
              <span className="bx-tabular font-mono font-semibold text-editorial-blue">
                {project.actual_progress_pct}% actual · {project.planned_progress_pct}% planned
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-xs bg-sand">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, project.actual_progress_pct))}%`,
                  backgroundColor:
                    project.status === 'At Risk'
                      ? '#F0785F'
                      : project.status === 'Completed'
                        ? '#8B9B91'
                        : '#183153',
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-charcoal/75">
              <span>
                Schedule Variance:{' '}
                <strong className={variance < 0 ? 'text-coral' : 'text-editorial-blue'}>
                  {variance > 0 ? `+${variance}%` : `${variance}%`}
                </strong>
              </span>
              <span className="bx-tabular font-mono">
                {project.latitude !== null && project.longitude !== null
                  ? `${project.latitude.toFixed(4)}°N, ${project.longitude.toFixed(4)}°E`
                  : 'Coordinates not set'}
              </span>
            </div>
          </div>

          {/* Selected 3D Component / Stage Inspector */}
          {selectedZone ? (
            <div className="rounded-sm border border-editorial-blue/30 bg-surface p-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="bx-label">
                    Stage {selectedZone.order} · {selectedZone.stageName}
                  </span>
                  <h3 className="mt-0.5 text-sm font-semibold text-editorial-blue">
                    {selectedZone.structuralPart}
                  </h3>
                </div>
                <Badge
                  variant={
                    selectedZone.visualState === 'completed'
                      ? 'success'
                      : selectedZone.visualState === 'at-risk'
                        ? 'warning'
                        : selectedZone.visualState === 'active'
                          ? 'info'
                          : 'neutral'
                  }
                >
                  {getZoneStateLabel(selectedZone.visualState)}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-charcoal/80">{selectedZone.description}</p>

              <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-sm bg-ivory/70 p-2 text-xs">
                <div>
                  <span className="text-[11px] text-charcoal/65">Stage Progress</span>
                  <p className="bx-tabular font-mono font-semibold text-editorial-blue">
                    {selectedZone.progressPct}%
                    {selectedZone.plannedPct !== null ? ` / ${selectedZone.plannedPct}% plan` : ''}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-charcoal/65">Data Grounding</span>
                  <p className="font-medium text-editorial-blue">{selectedZone.dataSourceLabel}</p>
                </div>
                {selectedZone.contractor && (
                  <div>
                    <span className="text-[11px] text-charcoal/65">Contractor</span>
                    <p className="truncate font-medium text-charcoal">{selectedZone.contractor}</p>
                  </div>
                )}
                {selectedZone.weatherRisk !== null && (
                  <div>
                    <span className="text-[11px] text-charcoal/65">Task Weather Risk</span>
                    <p className="bx-tabular font-mono font-medium text-charcoal">
                      {selectedZone.weatherRisk} / 5
                    </p>
                  </div>
                )}
              </div>

              {selectedZone.matchedTasks.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border-neutral pt-2 text-xs">
                  {selectedZone.matchedTasks.map((task) => (
                    <li
                      key={task.task_code}
                      className="flex items-center justify-between gap-2 text-charcoal/85"
                    >
                      <span className="truncate">
                        <span className="font-mono text-[11px] text-editorial-blue">
                          {task.task_code}
                        </span>{' '}
                        {task.task_name}
                      </span>
                      <span className="bx-tabular shrink-0 font-mono text-[11px] font-semibold">
                        {task.actual_progress_pct}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-border-neutral bg-ivory/40 p-3 text-xs text-charcoal/75">
              Click any bridge component in the 3D viewport—or select a stage below—to inspect
              persisted task progress and structural geometry focus.
            </div>
          )}

          {/* Live 7-Day Site Weather */}
          <div className="rounded-sm border border-border-neutral bg-ivory/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-editorial-blue">
                <CloudRain className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                Live Open-Meteo 7d Site Forecast
              </span>
              <span className="text-[11px] text-charcoal/65">{project.location}</span>
            </div>
            {weatherState.status === 'loading' && (
              <div className="mt-2">
                <LoadingIndicator label="Querying site weather..." />
              </div>
            )}
            {weatherState.status === 'ready' && weatherState.data && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  Rainy days (&ge;5mm):{' '}
                  <strong className="bx-tabular font-mono text-editorial-blue">
                    {weatherState.data.rainy_days_count} / {weatherState.data.forecast_days}
                  </strong>
                </span>
                <span>
                  Total rainfall:{' '}
                  <strong className="bx-tabular font-mono text-editorial-blue">
                    {weatherState.data.total_rainfall_mm.toFixed(1)} mm
                  </strong>
                </span>
              </div>
            )}
            {(weatherState.status === 'error' || weatherState.status === 'idle') && (
              <p className="mt-1.5 text-[11px] text-charcoal/65">
                {project.latitude === null
                  ? 'Add valid coordinates in Projects to enable site weather telemetry.'
                  : 'Open-Meteo weather telemetry unavailable while offline.'}
              </p>
            )}
          </div>

          {/* Accessible 8-Stage Keyboard List (Non-3D Alternative) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="bx-label flex items-center gap-1">
                <Database className="h-3 w-3" aria-hidden="true" />
                8 Structural Stages (Keyboard Accessible)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {zones.map((zone) => {
                const isSelected = selectedZone?.id === zone.id
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => {
                      onSelectZone(zone.id)
                      onFocusZone(zone.id)
                    }}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-between rounded-sm border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'border-editorial-blue bg-sand font-semibold text-editorial-blue'
                        : 'border-border-neutral bg-surface hover:bg-ivory'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {zone.visualState === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sage" aria-hidden="true" />
                      ) : zone.visualState === 'at-risk' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-coral" aria-hidden="true" />
                      ) : (
                        <Compass className="h-3.5 w-3.5 shrink-0 text-editorial-blue" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        {zone.order}. {zone.stageName}
                      </span>
                    </span>
                    <span className="bx-tabular ml-2 shrink-0 font-mono text-[11px]">
                      {zone.progressPct}%
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border-neutral pt-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => navigate(`/projects/${encodeURIComponent(project.project_code)}`)}
        >
          Full Project Detail
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<MapPin className="h-3.5 w-3.5" />}
          onClick={() => navigate('/maps')}
        >
          2D Corridor Map
        </Button>
      </CardFooter>
    </Card>
  )
}
