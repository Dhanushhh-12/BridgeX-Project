import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Download, Info, Printer, RefreshCw } from 'lucide-react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useGsapScrollSections } from '../lib/motion'
import {
  MlAndConstructionCharts,
  ProjectPortfolioCharts,
  WeatherAndCvAnalyticsSection,
} from '../components/analytics'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from '../components/ui'
import {
  CSV_CONTRACTOR_ANALYTICS,
  HELD_OUT_ML_SAMPLES,
  SAVED_CV_REPORTS,
} from '../data/analyticsDataset'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import { DEMO_CONSTRUCTION_TASKS } from '../data/demoProgressData'
import { MODEL_EVALUATION } from '../data/mlModelMetadata'
import { getHealth, getPlatformAnalytics, getWeather, postPredict } from '../services/apiClient'
import type {
  HealthResponse,
  PlatformAnalyticsResponse,
  PredictionRequestPayload,
  PredictionResponse,
  WeatherResponse,
} from '../types/api'
import { downloadAnalyticsCsv, type CsvExportRow } from '../utils/exportAnalyticsCsv'

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Reporting Periods' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

export function AnalyticsPage() {
  const analyticsPageRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  useGsapScrollSections(analyticsPageRef, '.bx-scroll-section', reduceMotion)

  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  )

  const [healthState, setHealthState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
  }>({ status: 'loading', data: null })

  const [weatherState, setWeatherState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  const [mlProbeState, setMlProbeState] = useState<{
    status: 'loading' | 'ready' | 'error' | 'empty'
    input: PredictionRequestPayload | null
    data: PredictionResponse | null
  }>({ status: 'loading', input: null, data: null })

  const [dbAnalytics, setDbAnalytics] = useState<PlatformAnalyticsResponse | null>(null)

  const filteredProjects = useMemo(() => {
    return DEMO_PROJECTS.filter((p) => {
      const matchProj = selectedProjectId === 'all' || p.id === selectedProjectId
      const matchPeriod = selectedPeriod === 'all' || p.reportingPeriod === selectedPeriod
      const matchFrom = !dateFrom || p.startDate >= dateFrom
      const matchTo = !dateTo || p.startDate <= dateTo
      return matchProj && matchPeriod && matchFrom && matchTo
    })
  }, [dateFrom, dateTo, selectedPeriod, selectedProjectId])

  const filteredTasks = useMemo(() => {
    const projectIds = new Set(filteredProjects.map((p) => p.id))
    return DEMO_CONSTRUCTION_TASKS.filter((t) => {
      const matchProject = projectIds.has(t.projectId)
      const matchPeriod = selectedPeriod === 'all' || t.reportingPeriod === selectedPeriod
      return matchProject && matchPeriod
    })
  }, [filteredProjects, selectedPeriod])

  const weatherTarget = useMemo(() => {
    const picked = filteredProjects[0] ?? DEMO_PROJECTS[0]
    return {
      label:
        selectedProjectId === 'all'
          ? `${picked.name} (Portfolio Default)`
          : `${picked.name} (${picked.location})`,
      latitude: picked.latitude,
      longitude: picked.longitude,
    }
  }, [filteredProjects, selectedProjectId])

  const weatherDays = selectedPeriod === '7d' ? 7 : 14
  const benchmarkPayload = filteredProjects[0]?.benchmarkTask ?? null

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setHealthState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setHealthState({ status: 'error', data: null })
      })

    getPlatformAnalytics()
      .then((data) => {
        if (!cancelled) setDbAnalytics(data)
      })
      .catch(() => {
        if (!cancelled) setDbAnalytics(null)
      })

    return () => {
      cancelled = true
    }
  }, [refreshNonce])

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
          setLastUpdated(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          )
        }
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
    return () => {
      cancelled = true
    }
  }, [refreshNonce, weatherDays, weatherTarget.latitude, weatherTarget.longitude])

  useEffect(() => {
    let cancelled = false
    if (!benchmarkPayload) {
      Promise.resolve().then(() => {
        if (!cancelled) setMlProbeState({ status: 'empty', input: null, data: null })
      })
      return () => {
        cancelled = true
      }
    }

    postPredict(benchmarkPayload)
      .then((data) => {
        if (!cancelled) {
          setMlProbeState({ status: 'ready', input: benchmarkPayload, data })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMlProbeState({ status: 'error', input: benchmarkPayload, data: null })
        }
      })
    return () => {
      cancelled = true
    }
  }, [benchmarkPayload, refreshNonce])

  function handleRefreshAll() {
    setHealthState((prev) => ({ ...prev, status: 'loading' }))
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlProbeState((prev) => ({ ...prev, status: 'loading' }))
    setRefreshNonce((n) => n + 1)
  }

  function handleResetFilters() {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setMlProbeState((prev) => ({ ...prev, status: 'loading' }))
    setSelectedProjectId('all')
    setSelectedPeriod('all')
    setDateFrom('')
    setDateTo('')
  }

  function handleExportCsv() {
    const rows: CsvExportRow[] = []

    filteredProjects.forEach((p) => {
      rows.push({
        section: 'Project Analytics',
        dataSource: 'DEMO DATA',
        itemLabel: `${p.projectCode} ${p.name}`,
        metricName: 'Actual vs Planned Progress (%)',
        value: `${p.actualProgressPct}% vs ${p.plannedProgressPct}%`,
        notes: `Status: ${p.status}; Start: ${p.startDate}`,
      })
    })

    filteredTasks.forEach((t) => {
      rows.push({
        section: 'Task Analytics',
        dataSource: 'DEMO DATA',
        itemLabel: `${t.taskCode} ${t.taskName}`,
        metricName: 'Current Progress (%) / Duration (days)',
        value: `${t.currentProgressPct}% / Plan ${t.plannedDurationDays}d`,
        notes: `Status: ${t.status}; Contractor: ${t.contractor}`,
      })
    })

    rows.push(
      {
        section: 'ML Evaluation',
        dataSource: 'VERIFIED MODEL (delay_predictor.pkl)',
        itemLabel: MODEL_EVALUATION.algorithm,
        metricName: 'MAE (days)',
        value: MODEL_EVALUATION.metrics.maeDays,
        notes: `${MODEL_EVALUATION.testRecords} held-out test records`,
      },
      {
        section: 'ML Evaluation',
        dataSource: 'VERIFIED MODEL (delay_predictor.pkl)',
        itemLabel: MODEL_EVALUATION.algorithm,
        metricName: 'RMSE (days)',
        value: MODEL_EVALUATION.metrics.rmseDays,
        notes: `Target: ${MODEL_EVALUATION.targetVariable}`,
      },
      {
        section: 'ML Evaluation',
        dataSource: 'VERIFIED MODEL (delay_predictor.pkl)',
        itemLabel: MODEL_EVALUATION.algorithm,
        metricName: 'R2 Score',
        value: MODEL_EVALUATION.metrics.r2Score,
        notes: `${MODEL_EVALUATION.metrics.r2Percent}% test variance explained`,
      },
    )

    HELD_OUT_ML_SAMPLES.forEach((s) => {
      rows.push({
        section: 'ML Held-Out Sample',
        dataSource: 'VERIFIED MODEL (delay_predictor.pkl)',
        itemLabel: `Task #${s.taskId} (${s.taskType})`,
        metricName: 'Predicted vs Recorded Actual (days)',
        value: `${s.predictedActualDays}d vs ${s.recordedActualDays}d`,
        notes: `Error: ${s.errorDays}d`,
      })
    })

    CSV_CONTRACTOR_ANALYTICS.forEach((c) => {
      rows.push({
        section: 'Contractor Analytics',
        dataSource: 'SYNTHETIC CSV (construction_tasks.csv)',
        itemLabel: c.contractor,
        metricName: 'Tasks / Mean Planned / Mean Actual / Overrun',
        value: `${c.taskCount} tasks | ${c.meanPlannedDays}d -> ${c.meanActualDays}d (+${c.meanOverrunDays}d)`,
        notes: '6000-row dataset aggregate',
      })
    })

    if (weatherState.status === 'ready' && weatherState.data) {
      weatherState.data.daily_forecast.forEach((d) => {
        rows.push({
          section: 'Weather Analytics',
          dataSource: 'LIVE OPEN-METEO API',
          itemLabel: `${weatherTarget.label} (${d.date})`,
          metricName: 'Daily Rainfall (mm)',
          value: d.rainfall_mm,
          notes: d.is_rainy ? 'Rainy (>= threshold)' : 'Dry window',
        })
      })
    }

    SAVED_CV_REPORTS.forEach((cv) => {
      rows.push({
        section: 'Computer Vision Archive',
        dataSource: 'SAVED CV CSV (data/images/reports)',
        itemLabel: cv.reportName,
        metricName: 'Image Diff % / Semantic Shift %',
        value: `${cv.imageDiffScorePct}% / ${cv.semanticRegionChangePct}%`,
        notes: `${cv.validationStatus}; ${cv.visibleChangesSummary}`,
      })
    })

    const dateTag = new Date().toISOString().slice(0, 10)
    downloadAnalyticsCsv(rows, `bridgex-analytics-${dateTag}.csv`)
  }

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All Projects (Demo Portfolio)' },
      ...DEMO_PROJECTS.map((p) => ({ value: p.id, label: p.name })),
    ],
    [],
  )

  const avgProjectProgress = useMemo(() => {
    if (filteredProjects.length === 0) return null
    return (
      filteredProjects.reduce((sum, p) => sum + p.actualProgressPct, 0) / filteredProjects.length
    )
  }, [filteredProjects])

  const hasFilters =
    selectedProjectId !== 'all' || selectedPeriod !== 'all' || Boolean(dateFrom) || Boolean(dateTo)

  return (
    <div ref={analyticsPageRef} className="space-y-6">
      <PageHeader
        eyebrow="Governance & Intelligence"
        title="Advanced Analytics & Insights"
        description="Unified portfolio, XGBoost ML evaluation, synthetic contractor baselines, live Open-Meteo weather, and saved CV analytics."
        breadcrumbs={[{ label: 'Analytics' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border-neutral bg-surface px-2.5 py-1.5 text-xs text-charcoal">
              <Calendar className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
              Updated: {lastUpdated}
            </span>
            {healthState.status === 'ready' && healthState.data ? (
              <Badge variant="success" showDot>
                API {healthState.data.version}: {healthState.data.status}
              </Badge>
            ) : (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={handleRefreshAll}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Printer className="h-3.5 w-3.5" />}
              onClick={() => window.print()}
            >
              Print / PDF
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Multi-Source Provenance Indicator */}
      <Card variant="sand" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-charcoal">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
            <p>
              <strong className="text-editorial-blue">Active Data Sources:</strong> Every chart is
              explicitly badged by origin so real ML/CSV/API outputs are never confused with demo
              portfolio rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="info">LIVE API (/weather, /predict)</Badge>
            <Badge variant="info">
              LIVE SQLITE ({dbAnalytics ? `${dbAnalytics.database_counts.projects}P / ${dbAnalytics.database_counts.tasks}T` : 'Connecting'})
            </Badge>
            <Badge variant="info">VERIFIED ML (R² 0.9744)</Badge>
            <Badge variant="info">
              SYNTHETIC CSV ({dbAnalytics ? dbAnalytics.csv_dataset.total_csv_rows.toLocaleString() : '6,000'} rows)
            </Badge>
            <Badge variant="warning">DEMO DATA (Fallback)</Badge>
          </div>
        </div>
      </Card>

      {/* Filters Toolbar */}
      <Card padding="sm" className="print:hidden">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Select
            label="Project Filter"
            options={projectOptions}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          />
          <Select
            label="Reporting Period"
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          />
          <Input
            label="Project Start From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="Project Start To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="md" disabled={!hasFilters} onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Executive Analytics KPI Summary */}
      <section aria-label="Executive Analytics Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Filtered Projects</span>
            <Badge variant="warning">DEMO DATA</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {filteredProjects.length}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            Avg Progress: {avgProjectProgress !== null ? `${avgProjectProgress.toFixed(1)}%` : '—'}
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">ML Accuracy (R² / MAE)</span>
            <Badge variant="info">VERIFIED ML</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {MODEL_EVALUATION.metrics.r2Score.toFixed(4)}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            MAE {MODEL_EVALUATION.metrics.maeDays}d · RMSE {MODEL_EVALUATION.metrics.rmseDays}d
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">CSV Contractor Records</span>
            <Badge variant="info">SYNTHETIC CSV</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {MODEL_EVALUATION.totalRecords.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            Across 5 contractors &amp; 8 task stages
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Saved CV Reports</span>
            <Badge variant="info">SAVED CSV</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {SAVED_CV_REPORTS.length}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            All pending engineer verification
          </p>
        </Card>
      </section>

      {/* Section 3: Project & Task Donut + Bar Charts */}
      <div className="bx-scroll-section">
        <ProjectPortfolioCharts
          projects={filteredProjects}
          tasks={filteredTasks}
          reduceMotion={reduceMotion}
        />
      </div>

      {/* Section 4 & 5: ML Model Analytics & Synthetic Construction/Contractor Analytics */}
      <div className="bx-scroll-section">
        <MlAndConstructionCharts
          liveBenchmarkInput={mlProbeState.input}
          liveBenchmarkResult={mlProbeState.data}
          liveBenchmarkStatus={mlProbeState.status}
          reduceMotion={reduceMotion}
        />
      </div>

      {/* Section 6 & 7: Weather Trends & Computer Vision Comparison Analytics */}
      <div className="bx-scroll-section">
        <WeatherAndCvAnalyticsSection
          siteLabel={weatherTarget.label}
          weatherStatus={weatherState.status}
          weather={weatherState.data}
          weatherError={weatherState.error}
          onRetryWeather={handleRefreshAll}
          reduceMotion={reduceMotion}
        />
      </div>
      {/* Live Database Telemetry & Recent Logs */}
      {dbAnalytics && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Persisted Backend Analytics Summary (SQLite)</CardTitle>
              <CardDescription>
                Live database metrics fetched from <code>GET /api/v1/analytics</code>.
              </CardDescription>
            </div>
            <Badge variant="info" showDot>
              LIVE SQLITE DB
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
              <p className="bx-label">DB Tasks (Completed / Delayed)</p>
              <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                {dbAnalytics.database_counts.tasks} ({dbAnalytics.database_counts.completed_tasks} done /{' '}
                {dbAnalytics.database_counts.delayed_tasks} delayed)
              </p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
              <p className="bx-label">ML Predictions Logged</p>
              <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                {dbAnalytics.database_counts.ml_predictions_logged}
              </p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
              <p className="bx-label">Weather Forecasts Logged</p>
              <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                {dbAnalytics.database_counts.weather_forecasts_logged}
              </p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
              <p className="bx-label">CV Inspections Logged</p>
              <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                {dbAnalytics.database_counts.cv_analyses_logged}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
