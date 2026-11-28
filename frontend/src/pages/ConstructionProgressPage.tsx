import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Hourglass,
  Info,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '../components/layout'
import {
  ConstructionStagesBoard,
  ProgressChartsSection,
  ProgressSummaryGrid,
  TaskTimelineCard,
} from '../components/progress'
import { BackendTasksPanel } from '../components/progress/BackendTasksPanel'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingIndicator,
  Modal,
  SearchField,
  Select,
  Table,
  type SortDirection,
  type TableColumn,
} from '../components/ui'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import {
  CSV_STAGE_BENCHMARKS,
  DEMO_CONSTRUCTION_TASKS,
  type DemoTaskProgressRecord,
  type TaskMonitoringStatus,
} from '../data/demoProgressData'
import { getHealth, postPredict } from '../services/apiClient'
import type { HealthResponse, PredictionResponse } from '../types/api'

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Periods' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Completed', label: 'Completed' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Delayed', label: 'Delayed (Duration > Plan)' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '6', label: '6 per page' },
  { value: '12', label: '12 per page' },
]

function StatusBadge({ status }: { status: TaskMonitoringStatus }) {
  if (status === 'Completed') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3 text-sage" aria-hidden="true" />
        Completed
      </Badge>
    )
  }
  if (status === 'In Progress') {
    return (
      <Badge variant="info">
        <Clock className="h-3 w-3 text-surface" aria-hidden="true" />
        In Progress
      </Badge>
    )
  }
  if (status === 'Delayed') {
    return (
      <Badge variant="critical">
        <AlertTriangle className="h-3 w-3 text-editorial-blue" aria-hidden="true" />
        Delayed
      </Badge>
    )
  }
  return (
    <Badge variant="neutral">
      <Hourglass className="h-3 w-3 text-charcoal/70" aria-hidden="true" />
      Pending
    </Badge>
  )
}

export function ConstructionProgressPage() {
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedStage, setSelectedStage] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState('taskCode')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(6)
  const [lastChecked, setLastChecked] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  )
  const [healthNonce, setHealthNonce] = useState(0)

  const [apiHealth, setApiHealth] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  // Modal state for live POST /predict check on any task row
  const [inspectTask, setInspectTask] = useState<DemoTaskProgressRecord | null>(null)
  const [mlCheck, setMlCheck] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: PredictionResponse | null
    error: string | null
  }>({ status: 'idle', data: null, error: null })

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setApiHealth({ status: 'ready', data, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setApiHealth({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Backend unavailable.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [healthNonce])

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All Projects (Demo)' },
      ...DEMO_PROJECTS.map((p) => ({ value: p.id, label: p.name })),
    ],
    [],
  )

  const stageOptions = useMemo(
    () => [
      { value: 'all', label: 'All 8 Stages' },
      ...CSV_STAGE_BENCHMARKS.map((s) => ({ value: s.stage, label: s.stage })),
    ],
    [],
  )

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = DEMO_CONSTRUCTION_TASKS.filter((task) => {
      const matchProject = selectedProjectId === 'all' || task.projectId === selectedProjectId
      const matchPeriod = selectedPeriod === 'all' || task.reportingPeriod === selectedPeriod
      const matchStatus = selectedStatus === 'all' || task.status === selectedStatus
      const matchStage = selectedStage === 'all' || task.category === selectedStage
      const matchQuery =
        !q ||
        task.taskCode.toLowerCase().includes(q) ||
        task.taskName.toLowerCase().includes(q) ||
        task.projectName.toLowerCase().includes(q) ||
        task.category.toLowerCase().includes(q) ||
        task.contractor.toLowerCase().includes(q)

      return matchProject && matchPeriod && matchStatus && matchStage && matchQuery
    })

    return [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'taskName':
          cmp = a.taskName.localeCompare(b.taskName)
          break
        case 'projectName':
          cmp = a.projectName.localeCompare(b.projectName)
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        case 'plannedDurationDays':
          cmp = a.plannedDurationDays - b.plannedDurationDays
          break
        case 'actualDurationDays':
          cmp = (a.actualDurationDays ?? -1) - (b.actualDurationDays ?? -1)
          break
        case 'currentProgressPct':
          cmp = a.currentProgressPct - b.currentProgressPct
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'contractor':
          cmp = a.contractor.localeCompare(b.contractor)
          break
        default:
          cmp = a.taskCode.localeCompare(b.taskCode)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [
    searchQuery,
    selectedPeriod,
    selectedProjectId,
    selectedStage,
    selectedStatus,
    sortDir,
    sortKey,
  ])

  const summary = useMemo(() => {
    const total = filteredTasks.length
    const completed = filteredTasks.filter((t) => t.status === 'Completed').length
    const inProgress = filteredTasks.filter((t) => t.status === 'In Progress').length
    const pending = filteredTasks.filter((t) => t.status === 'Pending').length
    const behind = filteredTasks.filter(
      (t) => t.actualDurationDays !== null && t.actualDurationDays > t.plannedDurationDays,
    ).length
    const avgProgress =
      total > 0
        ? filteredTasks.reduce((sum, t) => sum + t.currentProgressPct, 0) / total
        : null
    return { total, completed, inProgress, pending, behind, avgProgress }
  }, [filteredTasks])

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const paginatedTasks = filteredTasks.slice(startIdx, startIdx + pageSize)

  function handleSortChange(nextKey: string) {
    setCurrentPage(1)
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(nextKey)
      setSortDir('asc')
    }
  }

  function handleResetFilters() {
    setSelectedProjectId('all')
    setSelectedPeriod('all')
    setSelectedStatus('all')
    setSelectedStage('all')
    setSearchQuery('')
    setCurrentPage(1)
  }

  function handleRefreshBackendCheck() {
    setApiHealth((prev) => ({ ...prev, status: 'loading', error: null }))
    setLastChecked(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    )
    setHealthNonce((n) => n + 1)
  }

  async function handleInspectMlDuration(task: DemoTaskProgressRecord) {
    setInspectTask(task)
    setMlCheck({ status: 'loading', data: null, error: null })
    try {
      const data = await postPredict(task.mlInput)
      setMlCheck({ status: 'ready', data, error: null })
    } catch (err) {
      setMlCheck({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Unable to query POST /predict.',
      })
    }
  }

  const hasFilters =
    selectedProjectId !== 'all' ||
    selectedPeriod !== 'all' ||
    selectedStatus !== 'all' ||
    selectedStage !== 'all' ||
    Boolean(searchQuery)

  const columns: TableColumn<DemoTaskProgressRecord>[] = [
    {
      key: 'taskCode',
      header: 'Task ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">{row.taskCode}</span>
      ),
    },
    {
      key: 'taskName',
      header: 'Task Name',
      sortable: true,
      render: (row) => <span className="font-medium text-editorial-blue">{row.taskName}</span>,
    },
    {
      key: 'projectName',
      header: 'Project Name',
      sortable: true,
      render: (row) => <span className="text-xs text-charcoal">{row.projectName}</span>,
    },
    {
      key: 'category',
      header: 'Task Category',
      sortable: true,
      render: (row) => <Badge variant="neutral">{row.category}</Badge>,
    },
    {
      key: 'plannedStartDate',
      header: 'Planned Start Date',
      render: (row) => (
        <span className="text-xs text-charcoal/65">
          {row.plannedStartDate ?? 'Not in dataset'}
        </span>
      ),
    },
    {
      key: 'plannedDurationDays',
      header: 'Planned Duration',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.plannedDurationDays} days</span>,
    },
    {
      key: 'actualDurationDays',
      header: 'Actual Duration',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.actualDurationDays !== null ? `${row.actualDurationDays.toFixed(1)} days` : '—'}
        </span>
      ),
    },
    {
      key: 'currentProgressPct',
      header: 'Current Progress',
      sortable: true,
      render: (row) => (
        <div className="min-w-[100px] space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-editorial-blue">
            <span>{row.currentProgressPct}%</span>
            <span className="text-[10px] text-charcoal/65">Plan {row.plannedProgressPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-xs bg-sand" aria-hidden="true">
            <div
              className={row.status === 'Delayed' ? 'h-full bg-coral' : 'h-full bg-editorial-blue'}
              style={{ width: `${row.currentProgressPct}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Task Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'contractor',
      header: 'Responsible Contractor',
      sortable: true,
      render: (row) => (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-charcoal">{row.contractor}</span>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Cpu className="h-3.5 w-3.5" />}
            onClick={() => void handleInspectMlDuration(row)}
          >
            ML Check
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core Workspace"
        title="Construction Progress Monitoring"
        description="Track construction stages, planned vs. actual task progress, and duration schedule variances cleanly."
        breadcrumbs={[{ label: 'Construction Progress' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-border-neutral bg-surface px-2.5 py-1.5 text-xs text-charcoal">
              Checked: {lastChecked}
            </span>
            {apiHealth.status === 'ready' && apiHealth.data ? (
              <Badge variant="success" showDot>
                API {apiHealth.data.version}: {apiHealth.data.status}
              </Badge>
            ) : apiHealth.status === 'error' ? (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            ) : (
              <Badge variant="neutral">Checking API...</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              isLoading={apiHealth.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={handleRefreshBackendCheck}
            >
              Check Backend
            </Button>
          </div>
        }
      />

      {/* Dataset & Backend Integrity Banner */}
      <Card variant="sand" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-editorial-blue">Data Integrity Notice:</strong>{' '}
            <code>data/construction_tasks.csv</code> stores 6,000 <strong>synthetic</strong> task
            duration records without start dates, historical snapshots, or completion percentages,
            and FastAPI does not yet expose <code>GET /tasks</code>. Task completion percentages
            below are labeled <strong>DEMO DATA</strong> and are never derived from ML predicted
            duration days. Click <strong>ML Check</strong> on any task to verify live XGBoost{' '}
            <code>POST /predict</code> estimates.
          </p>
        </div>
      </Card>

      {apiHealth.status === 'error' && (
        <ErrorState
          compact
          title="FastAPI Backend Unavailable"
          message={apiHealth.error ?? 'Start Uvicorn to enable live ML duration verification.'}
          action={
            <Button size="sm" variant="outline" onClick={handleRefreshBackendCheck}>
              Retry
            </Button>
          }
        />
      )}

      {/* Filters Toolbar */}
      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2">
            <SearchField
              label="Search Tasks"
              value={searchQuery}
              onValueChange={(val) => {
                setSearchQuery(val)
                setCurrentPage(1)
              }}
              placeholder="Search task ID, name, category, contractor..."
            />
          </div>

          <Select
            label="Project"
            options={projectOptions}
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value)
              setCurrentPage(1)
            }}
          />

          <Select
            label="Reporting Period"
            options={PERIOD_OPTIONS}
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value)
              setCurrentPage(1)
            }}
          />

          <Select
            label="Task Status"
            options={STATUS_OPTIONS}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              setCurrentPage(1)
            }}
          />

          <div className="flex items-end justify-between gap-2">
            <Select
              label="Stage"
              options={stageOptions}
              value={selectedStage}
              onChange={(e) => {
                setSelectedStage(e.target.value)
                setCurrentPage(1)
              }}
            />
            <Button variant="outline" size="md" disabled={!hasFilters} onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress Summary Cards */}
      <ProgressSummaryGrid
        totalTasks={summary.total}
        completedTasks={summary.completed}
        inProgressTasks={summary.inProgress}
        pendingTasks={summary.pending}
        averageProgressPct={summary.avgProgress}
        behindScheduleTasks={summary.behind}
      />

      {/* 8 Construction Stages Pipeline */}
      <ConstructionStagesBoard
        tasks={filteredTasks}
        selectedStage={selectedStage}
        onSelectStage={(next) => {
          setSelectedStage(next)
          setCurrentPage(1)
        }}
      />

      {/* Progress Charts & Honest Historical Empty State */}
      <ProgressChartsSection tasks={filteredTasks} />

      {/* Duration-Only Timeline Variance View */}
      <TaskTimelineCard selectedProjectId={selectedProjectId} tasks={filteredTasks} />

      {/* Construction Task Monitoring Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Construction Task Monitoring Table</CardTitle>
            <CardDescription>
              All 10 structured monitoring columns. Calendar start dates are honestly marked unavailable
              where not recorded in the dataset.
            </CardDescription>
          </div>
          <Select
            aria-label="Tasks per page"
            options={PAGE_SIZE_OPTIONS}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
          />
        </CardHeader>

        <CardContent>
          <Table
            caption="Construction task monitoring table"
            columns={columns}
            data={paginatedTasks}
            rowKey={(row) => row.id}
            sortKey={sortKey}
            sortDirection={sortDir}
            onSortChange={handleSortChange}
            emptyTitle="No construction tasks match filters"
            emptyDescription="Reset search, project, period, status, or stage filters to view tasks."
          />
        </CardContent>

        <CardFooter className="flex-wrap justify-between">
          <span className="text-xs text-charcoal/80 bx-tabular">
            {filteredTasks.length === 0
              ? 'Showing 0 tasks'
              : `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredTasks.length)} of ${filteredTasks.length} demo tasks`}
          </span>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="px-2 font-mono text-xs font-medium text-editorial-blue">
              Page {safePage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages}
              rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Live SQLite Backend Tasks Panel */}
      <BackendTasksPanel />

      {/* Live POST /predict Verification Modal */}
      <Modal
        isOpen={Boolean(inspectTask)}
        onClose={() => setInspectTask(null)}
        title={inspectTask ? `ML Duration Check — ${inspectTask.taskCode}` : 'ML Duration Check'}
        description="Queries live POST /predict without confusing predicted duration (days) with task completion (%)."
        footer={
          <Button variant="outline" onClick={() => setInspectTask(null)}>
            Close
          </Button>
        }
      >
        {inspectTask && (
          <div className="space-y-4">
            <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3 text-xs space-y-1">
              <p className="font-semibold text-editorial-blue">{inspectTask.taskName}</p>
              <p className="text-charcoal/80">
                Category: <strong>{inspectTask.category}</strong> · Contractor:{' '}
                <strong>{inspectTask.contractor}</strong>
              </p>
              <p className="font-mono text-charcoal">
                Planned Duration: {inspectTask.plannedDurationDays}d · Crew:{' '}
                {inspectTask.mlInput.crew_size} · Weather Risk: {inspectTask.mlInput.weather_risk}/5
                · Complexity: {inspectTask.mlInput.complexity_level}/10
              </p>
            </div>

            {mlCheck.status === 'loading' && (
              <LoadingIndicator label="Running live XGBoost prediction..." />
            )}

            {mlCheck.status === 'error' && (
              <ErrorState
                title="Live ML Check Failed"
                message={mlCheck.error ?? 'Backend unavailable.'}
              />
            )}

            {mlCheck.status === 'ready' && mlCheck.data && (
              <div className="rounded-sm border border-editorial-blue bg-surface p-4">
                <p className="bx-label">Live POST /predict Result</p>
                <p className="mt-1 text-2xl font-semibold text-editorial-blue bx-tabular">
                  {mlCheck.data.predicted_value.toFixed(1)} {mlCheck.data.units}
                </p>
                <p className="mt-1 text-xs text-charcoal/80">
                  Target: <code>{mlCheck.data.target}</code> (estimated total task duration, not
                  physical completion percentage).
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
