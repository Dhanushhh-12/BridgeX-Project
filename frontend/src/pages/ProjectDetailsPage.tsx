import { useEffect, useState } from 'react'
import { ArrowLeft, Calendar, CloudRain, Clock, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingIndicator,
} from '../components/ui'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import { getWeather, postPredict } from '../services/apiClient'
import type { PredictionResponse, WeatherResponse } from '../types/api'

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = DEMO_PROJECTS.find((p) => p.id === projectId)

  const [weatherState, setWeatherState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  const [mlState, setMlState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: PredictionResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!project) return
    let cancelled = false

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
            error: err instanceof Error ? err.message : 'Weather service unavailable.',
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
            error: err instanceof Error ? err.message : 'ML prediction service unavailable.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [project])

  if (!project) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Project Details"
          title="Project Not Found"
          breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Not Found' }]}
        />
        <Card>
          <CardContent className="pt-0">
            <EmptyState
              title="Unknown Project Identifier"
              description="The requested project ID does not match any record in the portfolio."
              action={
                <Link to="/projects">
                  <Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                    Back to Projects
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${project.projectCode} · ${project.projectType}`}
        title={project.name}
        description={project.description}
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning" showDot>
              DEMO DATA Record
            </Badge>
            <Link to="/projects">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                Back to Projects
              </Button>
            </Link>
          </div>
        }
      />

      {/* Core Metadata (Demo Portfolio Fields) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm">
          <p className="bx-label">Location &amp; Coordinates</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-editorial-blue">
            <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
            {project.location}
          </p>
          <p className="mt-1 font-mono text-xs text-charcoal/75">
            {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}
          </p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Timeline (Demo)</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-editorial-blue">
            <Calendar className="h-4 w-4 text-sage" aria-hidden="true" />
            {project.startDate} &rarr; {project.expectedCompletion}
          </p>
          <p className="mt-1 text-[11px] text-charcoal/75">{project.corridor}</p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Progress (Demo)</p>
          <p className="mt-1.5 text-xl font-semibold text-editorial-blue bx-tabular">
            {project.actualProgressPct}%{' '}
            <span className="text-xs font-normal text-charcoal/75">
              (Planned {project.plannedProgressPct}%)
            </span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-xs bg-sand" aria-hidden="true">
            <div
              className={project.status === 'At Risk' ? 'h-full bg-coral' : 'h-full bg-editorial-blue'}
              style={{ width: `${project.actualProgressPct}%` }}
            />
          </div>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Current Status (Demo)</p>
          <div className="mt-2">
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
          </div>
        </Card>
      </div>

      {/* Live FastAPI Integrations for this Site */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live Site Weather (7-Day Forecast)</CardTitle>
              <CardDescription>
                Fetched live from <code>GET /weather</code> for {project.location} coordinates.
              </CardDescription>
            </div>
            <Badge variant={weatherState.status === 'ready' ? 'info' : 'neutral'} showDot>
              LIVE OPEN-METEO
            </Badge>
          </CardHeader>
          <CardContent>
            {weatherState.status === 'loading' && (
              <LoadingIndicator label="Loading site weather forecast..." />
            )}
            {weatherState.status === 'error' && (
              <ErrorState
                compact
                title="Weather unavailable"
                message={weatherState.error ?? 'Could not fetch Open-Meteo data.'}
              />
            )}
            {weatherState.status === 'ready' && weatherState.data && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                  <p className="bx-label">Forecast</p>
                  <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                    {weatherState.data.forecast_days} days
                  </p>
                </div>
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                  <p className="bx-label">Rainy Days</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-base font-semibold text-editorial-blue bx-tabular">
                    <CloudRain className="h-4 w-4 text-coral" aria-hidden="true" />
                    {weatherState.data.rainy_days_count}
                  </p>
                </div>
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                  <p className="bx-label">Total Rain</p>
                  <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                    {weatherState.data.total_rainfall_mm.toFixed(1)} {weatherState.data.units}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live ML Task Duration Benchmark</CardTitle>
              <CardDescription>
                Live <code>POST /predict</code> output for sample task{' '}
                <strong>{project.benchmarkTask.task_type}</strong>.
              </CardDescription>
            </div>
            <Badge variant={mlState.status === 'ready' ? 'info' : 'neutral'} showDot>
              LIVE ML API
            </Badge>
          </CardHeader>
          <CardContent>
            {mlState.status === 'loading' && (
              <LoadingIndicator label="Running XGBoost task prediction..." />
            )}
            {mlState.status === 'error' && (
              <ErrorState
                compact
                title="Prediction unavailable"
                message={mlState.error ?? 'Could not query POST /predict.'}
              />
            )}
            {mlState.status === 'ready' && mlState.data && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border-neutral bg-ivory/60 p-4">
                <div>
                  <p className="text-xs text-charcoal/80">
                    {project.benchmarkTask.task_type} · {project.benchmarkTask.contractor}
                  </p>
                  <p className="mt-1 font-mono text-xs text-charcoal">
                    Planned: {project.benchmarkTask.planned_duration} days · Crew:{' '}
                    {project.benchmarkTask.crew_size} · Weather Risk:{' '}
                    {project.benchmarkTask.weather_risk}/5
                  </p>
                </div>
                <div className="text-right">
                  <p className="inline-flex items-center gap-1.5 text-lg font-semibold text-editorial-blue bx-tabular">
                    <Clock className="h-4 w-4 text-coral" aria-hidden="true" />
                    {mlState.data.predicted_value.toFixed(1)} {mlState.data.units}
                  </p>
                  <p className="text-[11px] text-charcoal/75">Predicted actual_duration</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Honest Pending Database Sections */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Backend-Persisted Team, Tasks &amp; Reports</CardTitle>
            <CardDescription>
              Fields requiring database tables that do not yet exist in the backend.
            </CardDescription>
          </div>
          <Badge variant="neutral">Pending Database</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-sm border border-border-neutral bg-sand/40 p-4">
            <p className="bx-label">Assigned Team &amp; Manager</p>
            <p className="mt-1.5 text-xs text-charcoal/80">
              Unavailable — no users or team assignment tables exist in the backend yet.
            </p>
          </div>
          <div className="rounded-sm border border-border-neutral bg-sand/40 p-4">
            <p className="bx-label">Project Task Breakdown</p>
            <p className="mt-1.5 text-xs text-charcoal/80">
              Unavailable per project — the 6,000 rows in <code>construction_tasks.csv</code> are
              not linked to individual projects yet.
            </p>
          </div>
          <div className="rounded-sm border border-border-neutral bg-sand/40 p-4">
            <p className="bx-label">Linked CV Reports</p>
            <p className="mt-1.5 text-xs text-charcoal/80">
              Unavailable per project — saved CSV/HTML reports in <code>data/images/reports/</code>{' '}
              will connect in the Reports module.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
