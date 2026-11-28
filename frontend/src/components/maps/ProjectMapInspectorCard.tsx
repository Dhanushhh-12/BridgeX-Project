import { useEffect, useState } from 'react'
import { ArrowRight, Calendar, CloudRain, Clock, MapPin, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getWeather, postPredict } from '../../services/apiClient'
import type { PredictionResponse, WeatherResponse } from '../../types/api'
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
  ErrorState,
  LoadingIndicator,
} from '../ui'
import type { ValidMapProject } from './LeafletProjectMap'

export interface ProjectMapInspectorCardProps {
  project: ValidMapProject | null
  onClearSelection: () => void
  onZoomToProject: () => void
}

export function ProjectMapInspectorCard({
  project,
  onClearSelection,
  onZoomToProject,
}: ProjectMapInspectorCardProps) {
  const [weatherState, setWeatherState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
    error: string | null
  }>({ status: 'idle', data: null, error: null })

  const [mlState, setMlState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: PredictionResponse | null
    error: string | null
  }>({ status: 'idle', data: null, error: null })

  useEffect(() => {
    if (!project) return
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) {
        setWeatherState({ status: 'loading', data: null, error: null })
        setMlState({ status: 'loading', data: null, error: null })
      }
    })

    getWeather({
      latitude: project.latitude,
      longitude: project.longitude,
      days: 7,
      thresholdMm: 5.0,
    })
      .then((data) => {
        if (!cancelled) setWeatherState({ status: 'ready', data, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setWeatherState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Weather unavailable.',
          })
        }
      })

    postPredict(project.benchmarkTask)
      .then((data) => {
        if (!cancelled) setMlState({ status: 'ready', data, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setMlState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Prediction unavailable.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [project])

  if (!project) {
    return (
      <Card className="flex h-full flex-col justify-center">
        <EmptyState
          icon={<MapPin className="h-5 w-5 text-editorial-blue" />}
          title="Select a Map Marker or Project Row"
          description="Click any project marker on the OpenStreetMap canvas to inspect site coordinates, demo progress, live 7-day Open-Meteo weather, and live ML task duration."
        />
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col justify-between">
      <div>
        <CardHeader>
          <div className="min-w-0">
            <span className="bx-label">{project.projectCode} · {project.projectType}</span>
            <CardTitle className="mt-0.5 truncate">{project.name}</CardTitle>
            <CardDescription className="truncate">{project.corridor}</CardDescription>
          </div>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Deselect project marker"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border-neutral text-editorial-blue hover:bg-sand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant={
                project.status === 'At Risk'
                  ? 'critical'
                  : project.status === 'Completed'
                    ? 'success'
                    : 'info'
              }
              showDot
            >
              {project.status === 'At Risk' ? 'Attention Required' : project.status}
            </Badge>
            <Badge variant="warning">DEMO DATA Site</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-2.5">
              <p className="bx-label">Coordinates</p>
              <p className="mt-1 font-mono font-semibold text-editorial-blue">
                {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}
              </p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-2.5">
              <p className="bx-label">Progress (Demo)</p>
              <p className="mt-1 font-semibold text-editorial-blue bx-tabular">
                {project.actualProgressPct}% (Plan {project.plannedProgressPct}%)
              </p>
            </div>
          </div>

          <div className="rounded-sm border border-border-neutral bg-ivory/40 p-2.5 space-y-1">
            <p className="inline-flex items-center gap-1.5 font-medium text-editorial-blue">
              <Calendar className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
              {project.startDate} &rarr; {project.expectedCompletion} (Demo Timeline)
            </p>
            <p className="text-charcoal/75">
              Project Manager: {project.manager ?? 'Not assigned (No DB)'}
            </p>
          </div>

          {/* Live FastAPI Weather for Coordinates */}
          <div className="rounded-sm border border-border-neutral bg-surface p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-editorial-blue">
                <CloudRain className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                Live 7-Day Site Weather
              </span>
              <Badge variant={weatherState.status === 'ready' ? 'info' : 'neutral'}>
                GET /weather
              </Badge>
            </div>
            {weatherState.status === 'loading' && (
              <LoadingIndicator inline size="sm" label="Fetching Open-Meteo..." />
            )}
            {weatherState.status === 'error' && (
              <ErrorState compact title="Weather Offline" message={weatherState.error ?? ''} />
            )}
            {weatherState.status === 'ready' && weatherState.data && (
              <p className="font-mono text-charcoal">
                {weatherState.data.rainy_days_count} rainy day(s) &ge;{' '}
                {weatherState.data.rain_threshold_mm}mm · Total{' '}
                <strong>{weatherState.data.total_rainfall_mm.toFixed(1)} mm</strong>
              </p>
            )}
          </div>

          {/* Live FastAPI ML Duration Probe */}
          <div className="rounded-sm border border-border-neutral bg-surface p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold text-editorial-blue">
                <Clock className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
                Benchmark ML Duration
              </span>
              <Badge variant={mlState.status === 'ready' ? 'info' : 'neutral'}>
                POST /predict
              </Badge>
            </div>
            {mlState.status === 'loading' && (
              <LoadingIndicator inline size="sm" label="Running XGBoost..." />
            )}
            {mlState.status === 'error' && (
              <ErrorState compact title="ML Offline" message={mlState.error ?? ''} />
            )}
            {mlState.status === 'ready' && mlState.data && (
              <p className="font-mono text-charcoal">
                {project.benchmarkTask.task_type}:{' '}
                <strong className="text-coral">
                  {mlState.data.predicted_value.toFixed(1)} {mlState.data.units}
                </strong>{' '}
                (Plan {project.benchmarkTask.planned_duration}d)
              </p>
            )}
          </div>
        </CardContent>
      </div>

      <CardFooter className="justify-between">
        <Button size="sm" variant="outline" onClick={onZoomToProject}>
          Zoom to Site
        </Button>
        <Link to={`/projects/${project.id}`}>
          <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
