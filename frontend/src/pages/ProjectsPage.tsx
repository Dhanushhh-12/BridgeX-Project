import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  MapPin,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { ManagedProjectsPanel } from '../components/projects/ManagedProjectsPanel'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  SearchField,
  Select,
  Table,
  type SortDirection,
  type TableColumn,
} from '../components/ui'
import { DEMO_PROJECTS, type DemoProjectRecord } from '../data/demoOverviewData'
import { getHealth } from '../services/apiClient'
import type { HealthResponse } from '../types/api'

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'At Risk', label: 'Attention Required' },
  { value: 'Completed', label: 'Completed' },
]

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Project Types' },
  { value: 'Arch Bridge', label: 'Arch Bridge' },
  { value: 'Viaduct Deck', label: 'Viaduct Deck' },
  { value: 'Pier Rehabilitation', label: 'Pier Rehabilitation' },
  { value: 'Highway Overpass', label: 'Highway Overpass' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '5', label: '5 per page' },
  { value: '10', label: '10 per page' },
]

export function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<string>('projectCode')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(5)

  const [apiHealth, setApiHealth] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
  }>({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setApiHealth({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setApiHealth({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const locationOptions = useMemo(() => {
    const unique = Array.from(new Set(DEMO_PROJECTS.map((p) => p.location))).sort()
    return [
      { value: 'all', label: 'All Locations' },
      ...unique.map((loc) => ({ value: loc, label: loc })),
    ]
  }, [])

  const filteredAndSortedProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const filtered = DEMO_PROJECTS.filter((proj) => {
      const matchesSearch =
        !q ||
        proj.projectCode.toLowerCase().includes(q) ||
        proj.name.toLowerCase().includes(q) ||
        proj.location.toLowerCase().includes(q) ||
        proj.projectType.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || proj.status === statusFilter
      const matchesType = typeFilter === 'all' || proj.projectType === typeFilter
      const matchesLocation = locationFilter === 'all' || proj.location === locationFilter
      const matchesFrom = !dateFrom || proj.startDate >= dateFrom
      const matchesTo = !dateTo || proj.startDate <= dateTo

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesLocation &&
        matchesFrom &&
        matchesTo
      )
    })

    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'location':
          cmp = a.location.localeCompare(b.location)
          break
        case 'startDate':
          cmp = a.startDate.localeCompare(b.startDate)
          break
        case 'expectedCompletion':
          cmp = a.expectedCompletion.localeCompare(b.expectedCompletion)
          break
        case 'actualProgressPct':
          cmp = a.actualProgressPct - b.actualProgressPct
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        default:
          cmp = a.projectCode.localeCompare(b.projectCode)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [dateFrom, dateTo, locationFilter, searchQuery, sortDir, sortKey, statusFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedProjects.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const paginatedProjects = filteredAndSortedProjects.slice(startIdx, startIdx + pageSize)

  const summaryStats = useMemo(() => {
    const total = filteredAndSortedProjects.length
    const active = filteredAndSortedProjects.filter((p) => p.status === 'Active').length
    const completed = filteredAndSortedProjects.filter((p) => p.status === 'Completed').length
    const attention = filteredAndSortedProjects.filter((p) => p.status === 'At Risk').length
    return { total, active, completed, attention }
  }, [filteredAndSortedProjects])

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
    setSearchQuery('')
    setStatusFilter('all')
    setTypeFilter('all')
    setLocationFilter('all')
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    Boolean(searchQuery) ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    locationFilter !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  const columns: TableColumn<DemoProjectRecord>[] = [
    {
      key: 'projectCode',
      header: 'Project ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">
          {row.projectCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Project Name',
      sortable: true,
      render: (row) => (
        <div className="min-w-[170px]">
          <Link
            to={`/projects/${row.id}`}
            className="font-semibold text-editorial-blue hover:text-coral-hover hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-[11px] text-charcoal/70">{row.projectType}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-charcoal">
          <MapPin className="h-3.5 w-3.5 text-sage shrink-0" aria-hidden="true" />
          {row.location}
        </span>
      ),
    },
    {
      key: 'manager',
      header: 'Project Manager',
      render: (row) => (
        <span className="text-xs text-charcoal/65">
          {row.manager ?? 'Not assigned (No DB)'}
        </span>
      ),
    },
    {
      key: 'startDate',
      header: 'Start Date',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.startDate}</span>,
    },
    {
      key: 'expectedCompletion',
      header: 'Expected Completion',
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.expectedCompletion}</span>,
    },
    {
      key: 'actualProgressPct',
      header: 'Progress',
      sortable: true,
      render: (row) => (
        <div className="min-w-[110px] space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-editorial-blue">
            <span>{row.actualProgressPct}%</span>
            <span className="text-[10px] text-charcoal/65">Plan {row.plannedProgressPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-xs bg-sand" aria-hidden="true">
            <div
              className={row.status === 'At Risk' ? 'h-full bg-coral' : 'h-full bg-editorial-blue'}
              style={{ width: `${row.actualProgressPct}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge
          variant={
            row.status === 'At Risk'
              ? 'critical'
              : row.status === 'Completed'
                ? 'success'
                : 'info'
          }
          showDot
        >
          {row.status === 'At Risk' ? 'Attention Required' : row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Link to={`/projects/${row.id}`}>
          <Button size="sm" variant="outline" leftIcon={<Eye className="h-3.5 w-3.5" />}>
            View Details
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core Workspace"
        title="Project Management"
        description="Monitor infrastructure corridors, inspect site metadata, and verify project status cleanly."
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Badge variant="warning" showDot>
              DEMO DATA Portfolio
            </Badge>
          </div>
        }
      />

      {/* Explicit Persistence / Create & Edit Limitation Banner */}
      <Card variant="sand" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-editorial-blue">Backend Persistence Notice:</strong>{' '}
            Your FastAPI backend does not yet include a project database or{' '}
            <code>GET/POST/PATCH /projects</code> endpoints. Portfolio records below are{' '}
            <strong>DEMO DATA</strong>. <strong>Add Project</strong> and{' '}
            <strong>Edit Project</strong> actions are intentionally withheld so no fake save
            functionality is simulated—while <strong>View Details</strong> links each project to
            live FastAPI Weather (<code>/weather</code>) and ML (<code>/predict</code>) checks.
          </p>
        </div>
      </Card>

      {/* Summary Cards */}
      <section aria-label="Project Portfolio Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Total Projects</span>
            <Badge variant="warning">DEMO DATA</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {summaryStats.total}
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Active Projects</span>
            <Badge variant="warning">DEMO DATA</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {summaryStats.active}
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Completed</span>
            <Badge variant="warning">DEMO DATA</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-editorial-blue bx-tabular">
            {summaryStats.completed}
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Requires Attention</span>
            <Badge variant="warning">DEMO DATA</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-coral bx-tabular">
            {summaryStats.attention}
          </p>
        </Card>

        <Card padding="sm">
          <div className="flex items-center justify-between gap-2">
            <span className="bx-label">Delayed Projects</span>
            <Badge variant="neutral">Unavailable</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold text-editorial-blue">
            Awaiting Schedule DB
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/70">
            Not supported without persisted task logs
          </p>
        </Card>
      </section>

      {/* Filters Toolbar */}
      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2">
            <SearchField
              label="Search Projects"
              value={searchQuery}
              onValueChange={(val) => {
                setSearchQuery(val)
                setCurrentPage(1)
              }}
              placeholder="Search ID, name, location, or type..."
            />
          </div>

          <Select
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          />

          <Select
            label="Project Type"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setCurrentPage(1)
            }}
          />

          <Select
            label="Location"
            options={locationOptions}
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value)
              setCurrentPage(1)
            }}
          />

          <div className="flex items-end justify-end">
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

        <div className="mt-3 grid gap-3 border-t border-border-neutral pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Start Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setCurrentPage(1)
            }}
          />
          <Input
            label="Start Date To"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
      </Card>

      {/* Project Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Infrastructure Projects Directory</CardTitle>
            <CardDescription>
              Sortable, filterable, paginated portfolio view (DEMO DATA). Click any project or{' '}
              <strong>View Details</strong> to inspect live site weather and ML duration checks.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Rows per page"
              options={PAGE_SIZE_OPTIONS}
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            />
          </div>
        </CardHeader>

        <CardContent>
          <Table
            caption="Infrastructure project management table (demo data)"
            columns={columns}
            data={paginatedProjects}
            rowKey={(row) => row.id}
            sortKey={sortKey}
            sortDirection={sortDir}
            onSortChange={handleSortChange}
            emptyTitle="No projects match your criteria"
            emptyDescription="Adjust or reset your search query, status, type, location, or date filters."
          />
        </CardContent>

        <CardFooter className="flex-wrap justify-between">
          <span className="text-xs text-charcoal/80 bx-tabular">
            {filteredAndSortedProjects.length === 0
              ? 'Showing 0 records'
              : `Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredAndSortedProjects.length)} of ${filteredAndSortedProjects.length} demo projects`}
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

      {/* Role-Protected SQLite Backend Projects Panel */}
      <ManagedProjectsPanel />
    </div>
  )
}
