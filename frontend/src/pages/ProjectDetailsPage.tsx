import { useEffect, useMemo, useState } from 'react'
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
  Table,
  type TableColumn,
} from '../components/ui'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import {
  getBackendProjectDetail,
  getWeather,
  postPredict,
} from '../services/apiClient'
import type {
  BackendTaskRecord,
  ManagedProjectRecord,
  PredictionRequestPayload,
  PredictionResponse,
  WeatherResponse,
} from '../types/api'

function resolveProjectCode(rawId: string | undefined): string {
  if (!rawId) return ''
  const matchedDemo = DEMO_PROJECTS.find(
    (p) => p.id === rawId || p.projectCode.toLowerCase() === rawId.toLowerCase(),
  )
  return matchedDemo ? matchedDemo.projectCode : rawId.toUpperCase()
}

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const resolvedCode = resolveProjectCode(projectId)
  const fallbackDemo = useMemo(
    () =>
      DEMO_PROJECTS.find(
        (p) => p.id === projectId || p.projectCode.toUpperCase() === resolvedCode,
      ) ?? null,
    [projectId, resolvedCode],
  )

  const [detailState, setDetailState] = useState<{
    status: 'loading' | 'ready' | 'error'
    project: ManagedProjectRecord | null
    tasks: BackendTaskRecord[]
    error: string | null
  }>({ status: 'loading', project: null, tasks: [], error: null })

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
    if (!resolvedCode) return
    let cancelled = false

    getBackendProjectDetail(resolvedCode)
      .then((res) => {
        if (!cancelled) {
          setDetailState({
            status: 'ready',
            project: res.project,
            tasks: res.tasks,
            error: null,
          })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailState({
            status: 'error',
            project: null,
            tasks: [],
            error: err instanceof Error ? err.message : 'Unable to fetch project details.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [resolvedCode])

  const activeCoords = useMemo(() => {
    const lat = detailState.project?.latitude ?? fallbackDemo?.latitude ?? null
    const lon = detailState.project?.longitude ?? fallbackDemo?.longitude ?? null
    return lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null
  }, [detailState.project, fallbackDemo])

  const benchmarkPayload: PredictionRequestPayload | null = useMemo(() => {
    const firstTask = detailState.tasks[0]
    if (firstTask) {
      return {
        task_type: firstTask.category,
        contractor: firstTask.contractor,
        planned_duration: firstTask.planned_duration_days,
        crew_size: firstTask.crew_size,
        material_cost: firstTask.material_cost,
        weather_risk: firstTask.weather_risk,
        complexity_level: firstTask.complexity_level,
      }
    }
    if (fallbackDemo) return fallbackDemo.benchmarkTask
    if (detailState.project) {
      return {
        task_type: 'Excavation',
        contractor: 'Apex Builders',
        planned_duration: 12,
        crew_size: 16,
        material_cost: 65000,
        weather_risk: 2,
        complexity_level: 5,
      }
    }
    return null
  }, [detailState.project, detailState.tasks, fallbackDemo])

  useEffect(() => {
    if (!activeCoords) return
    let cancelled = false
    getWeather({
      latitude: activeCoords.latitude,
      longitude: activeCoords.longitude,
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
    return () => {
      cancelled = true
    }
  }, [activeCoords])

  useEffect(() => {
    if (!benchmarkPayload) return
    let cancelled = false
    postPredict(benchmarkPayload)
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
  }, [benchmarkPayload])

  if (detailState.status === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Project Details"
          title={`Loading ${resolvedCode}...`}
          breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: resolvedCode }]}
        />
        <Card>
          <LoadingIndicator label="Loading persisted project record and tasks from FastAPI..." />
        </Card>
      </div>
    )
  }

  const projectRecord = detailState.project
  if (!projectRecord) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Project Details"
          title="Project Not Found or Restricted"
          breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Unavailable' }]}
        />
        <Card>
          <CardContent className="pt-0">
            <EmptyState
              title="Project Unavailable"
              description={
                detailState.error ??
                'The requested project identifier does not exist or is restricted for your role.'
              }
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

  const taskColumns: TableColumn<BackendTaskRecord>[] = [
    {
      key: 'task_code',
      header: 'Task Code',
      render: (r) => <span className="font-mono text-xs font-semibold text-editorial-blue">{r.task_code}</span>,
    },
    {
      key: 'task_name',
      header: 'Task Name',
      render: (r) => <span className="font-medium text-editorial-blue">{r.task_name}</span>,
    },
    {
      key: 'category',
      header: 'Stage / Contractor',
      render: (r) => (
        <span className="text-xs text-charcoal/80">
          {r.category} · {r.contractor}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (r) => (
        <span className="font-mono text-xs text-editorial-blue bx-tabular">
          {r.actual_progress_pct}% / {r.planned_progress_pct}% plan
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge
          variant={
            r.status === 'Delayed'
              ? 'critical'
              : r.status === 'Completed'
                ? 'success'
                : r.status === 'In Progress'
                  ? 'info'
                  : 'neutral'
          }
          showDot
        >
          {r.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${projectRecord.project_code} · ${projectRecord.project_type}`}
        title={projectRecord.name}
        description={
          projectRecord.description || projectRecord.notes || 'Persisted SQLite infrastructure record.'
        }
        breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: projectRecord.project_code }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={projectRecord.is_demo_reference ? 'warning' : 'info'} showDot>
              {projectRecord.is_demo_reference ? 'SEEDED DEMO REF (SQLite)' : 'Persisted SQLite'}
            </Badge>
            <Link to="/projects">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                Back to Projects
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm">
          <p className="bx-label">Location &amp; Coordinates</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-editorial-blue">
            <MapPin className="h-4 w-4 text-coral" aria-hidden="true" />
            {projectRecord.location}
          </p>
          <p className="mt-1 font-mono text-xs text-charcoal/75">
            {activeCoords
              ? `${activeCoords.latitude.toFixed(4)}, ${activeCoords.longitude.toFixed(4)}`
              : 'Coordinates unset'}
          </p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Timeline &amp; Corridor</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-editorial-blue">
            <Calendar className="h-4 w-4 text-sage" aria-hidden="true" />
            {projectRecord.start_date || '—'} &rarr; {projectRecord.expected_completion || '—'}
          </p>
          <p className="mt-1 text-[11px] text-charcoal/75">{projectRecord.corridor}</p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Database Progress</p>
          <p className="mt-1.5 text-xl font-semibold text-editorial-blue bx-tabular">
            {projectRecord.actual_progress_pct}%{' '}
            <span className="text-xs font-normal text-charcoal/75">
              (Planned {projectRecord.planned_progress_pct}%)
            </span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-xs bg-sand" aria-hidden="true">
            <div
              className={projectRecord.status === 'At Risk' ? 'h-full bg-coral' : 'h-full bg-editorial-blue'}
              style={{ width: `${projectRecord.actual_progress_pct}%` }}
            />
          </div>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Project Status</p>
          <div className="mt-2">
            <Badge
              variant={
                projectRecord.status === 'At Risk'
                  ? 'critical'
                  : projectRecord.status === 'Completed'
                    ? 'success'
                    : 'info'
              }
              showDot
            >
              {projectRecord.status === 'At Risk' ? 'Attention Required' : projectRecord.status}
            </Badge>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live Site Weather (7-Day Forecast)</CardTitle>
              <CardDescription>
                Fetched live from <code>GET /weather</code> for {projectRecord.location}.
              </CardDescription>
            </div>
            <Badge variant={weatherState.status === 'ready' ? 'info' : 'neutral'} showDot>
              LIVE FORECAST
            </Badge>
          </CardHeader>
          <CardContent>
            {!activeCoords ? (
              <EmptyState
                title="No Coordinates Stored"
                description="Add latitude and longitude to enable site weather forecasts."
              />
            ) : weatherState.status === 'loading' ? (
              <LoadingIndicator label="Loading site weather forecast..." />
            ) : weatherState.status === 'error' ? (
              <ErrorState
                compact
                title="Weather unavailable"
                message={weatherState.error ?? 'Could not fetch Open-Meteo data.'}
              />
            ) : (
              weatherState.data && (
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
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live ML Task Duration Benchmark</CardTitle>
              <CardDescription>
                Live <code>POST /predict</code> estimate for{' '}
                <strong>{benchmarkPayload?.task_type ?? 'project benchmark'}</strong>.
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
            {mlState.status === 'ready' && mlState.data && benchmarkPayload && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border-neutral bg-ivory/60 p-4">
                <div>
                  <p className="text-xs text-charcoal/80">
                    {benchmarkPayload.task_type} · {benchmarkPayload.contractor}
                  </p>
                  <p className="mt-1 font-mono text-xs text-charcoal">
                    Planned: {benchmarkPayload.planned_duration}d · Crew:{' '}
                    {benchmarkPayload.crew_size} · Weather Risk: {benchmarkPayload.weather_risk}/5
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

      {/* Persisted SQLite Tasks Breakdown */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Persisted Construction Tasks ({detailState.tasks.length})</CardTitle>
            <CardDescription>
              Retrieved directly from SQLite via{' '}
              <code>GET /api/v1/projects/{projectRecord.project_code}</code>.
            </CardDescription>
          </div>
          <Badge variant="info">SQLite DB</Badge>
        </CardHeader>
        <CardContent>
          <Table
            caption="Project tasks stored in SQLite"
            columns={taskColumns}
            data={detailState.tasks}
            rowKey={(r) => r.task_code}
            emptyTitle="No construction tasks linked yet"
            emptyDescription="Create or assign construction tasks under this project via POST /api/v1/projects/{code}/tasks."
          />
        </CardContent>
      </Card>
    </div>
  )
}
