import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle2, Info, RefreshCw, WifiOff } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useGsapScrollSections } from '../lib/motion'
import {
  ConstructionProgressChart,
  DelayPredictionSummary,
  KpiSummaryGrid,
  WeatherRiskCard,
  type BenchmarkPredictionItem,
} from '../components/dashboard'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Select,
  Table,
  type TableColumn,
} from '../components/ui'
import {
  DEMO_ACTIVITY,
  DEMO_PROJECTS,
  type DemoActivityRecord,
} from '../data/demoOverviewData'
import {
  getHealth,
  getPlatformAnalytics,
  getSystemInfo,
  getWeather,
  postPredict,
} from '../services/apiClient'
import type {
  HealthResponse,
  PlatformAnalyticsResponse,
  SystemInfoResponse,
  WeatherResponse,
} from '../types/api'

const DEFAULT_COORDS = { label: 'Hyderabad Site (Default)', latitude: 17.385, longitude: 78.4867 }

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Periods (14d Weather)' },
  { value: '7d', label: 'Last 7 Days (7d Weather)' },
  { value: '14d', label: 'Last 14 Days (14d Weather)' },
  { value: '30d', label: 'Last 30 Days (14d Weather)' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'At Risk', label: 'At Risk' },
  { value: 'Completed', label: 'Completed' },
]

export function ExecutiveOverviewPage() {
  const pageRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  useGsapScrollSections(pageRef, '.bx-scroll-section', reducedMotion)

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [refreshToken, setRefreshToken] = useState<number>(0)

  const [weatherNonce, setWeatherNonce] = useState<number>(0)
  const [mlNonce, setMlNonce] = useState<number>(0)

  // Live Backend Status State (/health & /system-info)
  const [healthState, setHealthState] = useState<{
    status: 'loading' | 'ready' | 'error'
    health: HealthResponse | null
    system: SystemInfoResponse | null
    error: string | null
  }>({ status: 'loading', health: null, system: null, error: null })

  // Live Weather State (/weather)
  const [weatherState, setWeatherState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  // Live ML Predictions State (/predict)
  const [mlState, setMlState] = useState<{
    status: 'loading' | 'ready' | 'error' | 'empty'
    items: BenchmarkPredictionItem[]
    error: string | null
  }>({ status: 'loading', items: [], error: null })

  const [analyticsData, setAnalyticsData] = useState<PlatformAnalyticsResponse | null>(null)

  const [lastRefreshed, setLastRefreshed] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  )

  const filteredProjects = useMemo(() => {
    return DEMO_PROJECTS.filter((proj) => {
      const matchProject = selectedProjectId === 'all' || proj.id === selectedProjectId
      const matchPeriod = selectedPeriod === 'all' || proj.reportingPeriod === selectedPeriod
      const matchStatus = selectedStatus === 'all' || proj.status === selectedStatus
      return matchProject && matchPeriod && matchStatus
    })
  }, [selectedPeriod, selectedProjectId, selectedStatus])

  const filteredActivities = useMemo(() => {
    const allowedIds = new Set(filteredProjects.map((p) => p.id))
    return DEMO_ACTIVITY.filter((act) => {
      const matchProject = allowedIds.has(act.projectId)
      const matchPeriod = selectedPeriod === 'all' || act.reportingPeriod === selectedPeriod
      const matchStatus = selectedStatus === 'all' || act.status === selectedStatus
      return matchProject && matchPeriod && matchStatus
    })
  }, [filteredProjects, selectedPeriod, selectedStatus])

  const weatherTarget = useMemo(() => {
    if (selectedProjectId !== 'all') {
      const found = DEMO_PROJECTS.find((p) => p.id === selectedProjectId)
      if (found) {
        return {
          label: `${found.name} (${found.latitude.toFixed(2)}, ${found.longitude.toFixed(2)})`,
          latitude: found.latitude,
          longitude: found.longitude,
        }
      }
    }
    return DEFAULT_COORDS
  }, [selectedProjectId])

  const weatherDays = selectedPeriod === '7d' ? 7 : 14

  useEffect(() => {
    let cancelled = false
    Promise.all([getHealth(), getSystemInfo()])
      .then(([health, system]) => {
        if (!cancelled) {
          setHealthState({ status: 'ready', health, system, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHealthState({
            status: 'error',
            health: null,
            system: null,
            error: err instanceof Error ? err.message : 'Backend unavailable.',
          })
        }
      })

    getPlatformAnalytics()
      .then((data) => {
        if (!cancelled) setAnalyticsData(data)
      })
      .catch(() => {
        if (!cancelled) setAnalyticsData(null)
      })

    return () => {
      cancelled = true
    }
  }, [refreshToken])

  useEffect(() => {
    let cancelled = false
    getWeather({
      latitude: weatherTarget.latitude,
      longitude: weatherTarget.longitude,
      days: weatherDays,
      thresholdMm: 5.0,
    })
      .then((data) => {
        if (!cancelled) {
          setWeatherState({ status: 'ready', data, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWeatherState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Weather endpoint unavailable.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [weatherDays, weatherTarget.latitude, weatherTarget.longitude, refreshToken, weatherNonce])

  useEffect(() => {
    let cancelled = false
    if (filteredProjects.length === 0) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setMlState({ status: 'empty', items: [], error: null })
        }
      })
      return () => {
        cancelled = true
      }
    }

    Promise.all(
      filteredProjects.map(async (proj) => ({
        projectId: proj.id,
        projectName: proj.name,
        input: proj.benchmarkTask,
        result: await postPredict(proj.benchmarkTask),
      })),
    )
      .then((results) => {
        if (!cancelled) {
          setMlState({ status: 'ready', items: results, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMlState({
            status: 'error',
            items: [],
            error: err instanceof Error ? err.message : 'POST /predict unavailable.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [filteredProjects, refreshToken, mlNonce])

  function handleRetryWeather() {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setWeatherNonce((prev) => prev + 1)
  }

  function handleRetryMl() {
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlNonce((prev) => prev + 1)
  }

  function handleRefreshAll() {
    setHealthState((prev) => ({ ...prev, status: 'loading', error: null }))
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setLastRefreshed(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    )
    setRefreshToken((prev) => prev + 1)
  }

  function handleProjectFilterChange(nextId: string) {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setSelectedProjectId(nextId)
  }

  function handlePeriodFilterChange(nextPeriod: string) {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setSelectedPeriod(nextPeriod)
  }

  function handleStatusFilterChange(nextStatus: string) {
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setSelectedStatus(nextStatus)
  }

  function handleResetFilters() {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlState((prev) => ({ ...prev, status: 'loading', error: null }))
    setSelectedProjectId('all')
    setSelectedPeriod('all')
    setSelectedStatus('all')
  }

  const kpiMetrics = useMemo(() => {
    const total = filteredProjects.length
    const active = filteredProjects.filter((p) => p.status === 'Active').length
    const atRisk = filteredProjects.filter((p) => p.status === 'At Risk').length
    const completed = filteredProjects.filter((p) => p.status === 'Completed').length
    const avgProgress =
      total > 0
        ? filteredProjects.reduce((sum, p) => sum + p.actualProgressPct, 0) / total
        : null
    const avgMlDuration =
      mlState.status === 'ready' && mlState.items.length > 0
        ? mlState.items.reduce((sum, item) => sum + item.result.predicted_value, 0) /
          mlState.items.length
        : null

    return { total, active, atRisk, completed, avgProgress, avgMlDuration }
  }, [filteredProjects, mlState.items, mlState.status])

  const projectSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'All Portfolio Projects (Demo)' },
      ...DEMO_PROJECTS.map((p) => ({ value: p.id, label: p.name })),
    ],
    [],
  )

  const activityColumns: TableColumn<DemoActivityRecord>[] = [
    {
      key: 'projectOrTask',
      header: 'Project / Task',
      render: (row) => <span className="font-semibold text-editorial-blue">{row.projectOrTask}</span>,
    },
    {
      key: 'description',
      header: 'Activity Description',
      render: (row) => <span className="text-xs text-charcoal/85">{row.description}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'At Risk' ? 'critical' : row.status === 'Completed' ? 'success' : 'info'
          }
          showDot
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Reporting Period',
      render: (row) => <span className="font-mono text-xs">{row.date}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => <Badge variant="warning">{row.source}</Badge>,
    },
  ]

  const isAnyLoading =
    healthState.status === 'loading' ||
    weatherState.status === 'loading' ||
    mlState.status === 'loading'

  const hasActiveFilters =
    selectedProjectId !== 'all' || selectedPeriod !== 'all' || selectedStatus !== 'all'

  return (
    <div ref={pageRef} className="space-y-6">
      <PageHeader
        eyebrow="Executive Intelligence"
        title="Executive Overview"
        description="Infrastructure Project Intelligence and Monitoring"
        breadcrumbs={[{ label: 'Overview' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border-neutral bg-surface px-3 py-1.5 text-xs text-charcoal">
              <Calendar className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
              <span>Updated: {lastRefreshed}</span>
            </span>

            {healthState.status === 'ready' && healthState.health ? (
              <Badge variant="success" showDot>
                API {healthState.health.version}: {healthState.health.status}
              </Badge>
            ) : healthState.status === 'error' ? (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            ) : (
              <Badge variant="neutral">Checking API...</Badge>
            )}

            <Button
              variant="primary"
              size="sm"
              isLoading={isAnyLoading}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={handleRefreshAll}
            >
              Refresh Live Data
            </Button>
          </div>
        }
      />

      {/* Transparent Data Grounding Notice */}
      <Card variant="sand" padding="sm">
        <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-charcoal">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="text-editorial-blue">Data Source Transparency:</strong> System
              health (<code>/health</code>, <code>/system-info</code>), daily rainfall forecasts (
              <code>/weather</code>), and ML task durations (<code>/predict</code>) are fetched{' '}
              <strong>live from your FastAPI backend</strong>. Portfolio KPIs, progress bars, and
              activity logs are labeled <strong>DEMO DATA</strong> until project/task persistence
              endpoints are added.
            </p>
          </div>
          {healthState.status === 'ready' && healthState.system && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-editorial-blue">
              <CheckCircle2 className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
              {healthState.system.application_name} ({healthState.system.backend_status})
            </span>
          )}
        </div>
      </Card>

      {healthState.status === 'error' && (
        <ErrorState
          compact
          title="FastAPI Backend Not Reachable"
          message={
            healthState.error ??
            'Start Uvicorn (`python -m uvicorn backend.api.api:app --reload`) to enable live ML and Weather checks.'
          }
          action={
            <Button
              size="sm"
              variant="outline"
              leftIcon={<WifiOff className="h-3.5 w-3.5" />}
              onClick={handleRefreshAll}
            >
              Retry Connection
            </Button>
          }
        />
      )}

      {/* Working Filters Bar */}
      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <Select
            label="Project Selection (Demo + Weather Target)"
            options={projectSelectOptions}
            value={selectedProjectId}
            onChange={(e) => handleProjectFilterChange(e.target.value)}
          />
          <Select
            label="Reporting Period"
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={(e) => handlePeriodFilterChange(e.target.value)}
          />
          <Select
            label="Project Status"
            options={STATUS_OPTIONS}
            value={selectedStatus}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="md"
              disabled={!hasActiveFilters}
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <KpiSummaryGrid
        totalProjects={kpiMetrics.total}
        activeProjects={kpiMetrics.active}
        averageProgressPct={kpiMetrics.avgProgress}
        atRiskProjects={kpiMetrics.atRisk}
        completedProjects={kpiMetrics.completed}
        averagePredictedDurationDays={kpiMetrics.avgMlDuration}
        mlStatus={mlState.status}
      />

      {/* Charts & Live Intelligence Grid */}
      <div className="bx-scroll-section grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <ConstructionProgressChart projects={filteredProjects} />
        </div>
        <div className="xl:col-span-5">
          <WeatherRiskCard
            siteLabel={weatherTarget.label}
            status={weatherState.status}
            errorMessage={weatherState.error}
            weather={weatherState.data}
            onRetry={handleRetryWeather}
          />
        </div>
      </div>

      {/* ML Delay Prediction Overview */}
      <div className="bx-scroll-section">
        <DelayPredictionSummary
          status={mlState.status}
          errorMessage={mlState.error}
          items={mlState.items}
          onRetry={handleRetryMl}
        />
      </div>

      {/* Recent Project Activity Table */}
      <div className="bx-scroll-section">
        <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent Project Activity</CardTitle>
            <CardDescription>
              Sample portfolio activity log synchronized with the active filters above.
            </CardDescription>
          </div>
          <Badge variant="warning" showDot>
            DEMO DATA
          </Badge>
        </CardHeader>
        <CardContent>
          <Table
            caption="Recent project activity records (demo data)"
            columns={activityColumns}
            data={filteredActivities}
            rowKey={(row) => row.id}
            emptyTitle="No matching activity logs"
            emptyDescription="Adjust the project, reporting period, or status filter to view activity entries."
          />
        </CardContent>
      </Card>
      </div>

      {/* Live SQLite Database Telemetry & Audit Feed */}
      {analyticsData && (
        <div className="bx-scroll-section">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live SQLite Platform Integration Summary</CardTitle>
              <CardDescription>
                Real database counts and audit trail fetched from <code>GET /api/v1/analytics</code>.
              </CardDescription>
            </div>
            <Badge variant="info" showDot>
              LIVE SQLITE DB
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">DB Projects</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.projects}
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">DB Tasks</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.tasks}
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">ML Runs Logged</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.ml_predictions_logged}
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">Weather Queries</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.weather_forecasts_logged}
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">CV Analyses</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.cv_analyses_logged}
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">Reports Exported</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {analyticsData.database_counts.reports_generated}
                </p>
              </div>
            </div>

            {analyticsData.recent_audit_logs.length > 0 && (
              <div className="rounded-sm border border-border-neutral bg-ivory/35 p-3">
                <p className="bx-label mb-2">Recent Backend Audit Events</p>
                <ul className="space-y-1 text-xs text-charcoal/85">
                  {analyticsData.recent_audit_logs.slice(0, 5).map((log) => (
                    <li key={log.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong className="text-editorial-blue">{log.action}</strong> ({log.entity_type}{' '}
                        <code>{log.entity_id}</code>) by {log.actor_username} [{log.actor_role}]
                      </span>
                      <span className="font-mono text-[11px] text-charcoal/65">
                        {log.details}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}
