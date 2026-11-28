import { useEffect, useMemo, useState } from 'react'
import { Box, Compass, Info, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import {
  LeafletProjectMap,
  ProjectMapInspectorCard,
  type ValidMapProject,
} from '../components/maps'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SearchField,
  Select,
  Table,
  type TableColumn,
} from '../components/ui'
import { DEMO_PROJECTS, type DemoProjectRecord } from '../data/demoOverviewData'
import { getBackendProjects, getHealth } from '../services/apiClient'
import type { HealthResponse, ManagedProjectRecord } from '../types/api'
import { partitionProjectsByCoordinates } from '../utils/geoValidation'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'At Risk', label: 'Attention Required' },
  { value: 'Completed', label: 'Completed' },
]

const SOURCE_OPTIONS = [
  { value: 'backend', label: 'Live SQLite Database (GET /api/v1/projects)' },
  { value: 'demo', label: 'Static Portfolio Demo Fallback' },
]

function mapBackendProjectToMapRecord(proj: ManagedProjectRecord): DemoProjectRecord | null {
  if (proj.latitude === null || proj.longitude === null) return null
  const matchingFallback = DEMO_PROJECTS.find(
    (d) => d.projectCode.toUpperCase() === proj.project_code.toUpperCase(),
  )
  return {
    id: proj.project_code,
    projectCode: proj.project_code,
    name: proj.name,
    projectType:
      (proj.project_type as DemoProjectRecord['projectType']) || 'Arch Bridge',
    location: proj.location,
    corridor: proj.corridor,
    manager: null,
    startDate: proj.start_date || '2026-01-01',
    expectedCompletion: proj.expected_completion || '2026-12-31',
    description: proj.description || proj.notes || 'Persisted SQLite infrastructure record.',
    status: proj.status,
    reportingPeriod: '7d',
    plannedProgressPct: proj.planned_progress_pct,
    actualProgressPct: proj.actual_progress_pct,
    latitude: proj.latitude,
    longitude: proj.longitude,
    benchmarkTask: matchingFallback?.benchmarkTask ?? {
      task_type: 'Excavation',
      contractor: 'Apex Builders',
      planned_duration: 10,
      crew_size: 14,
      material_cost: 60000,
      weather_risk: 2,
      complexity_level: 5,
    },
  }
}

export function ProjectMapsPage() {
  const navigate = useNavigate()
  const [dataSource, setDataSource] = useState<'backend' | 'demo'>('backend')
  const [backendProjects, setBackendProjects] = useState<ManagedProjectRecord[]>([])
  const [backendLoadError, setBackendLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [healthNonce, setHealthNonce] = useState(0)

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

    getBackendProjects()
      .then((res) => {
        if (!cancelled) {
          setBackendProjects(res.projects)
          setBackendLoadError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBackendLoadError(err instanceof Error ? err.message : 'Unable to fetch /api/v1/projects.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [healthNonce])

  const rawSourceProjects = useMemo(() => {
    if (dataSource === 'demo') return DEMO_PROJECTS
    return backendProjects
      .map(mapBackendProjectToMapRecord)
      .filter((p): p is DemoProjectRecord => p !== null)
  }, [backendProjects, dataSource])

  const locationOptions = useMemo(() => {
    const unique = Array.from(new Set(rawSourceProjects.map((p) => p.location))).sort()
    return [
      { value: 'all', label: 'All Locations' },
      ...unique.map((loc) => ({ value: loc, label: loc })),
    ]
  }, [rawSourceProjects])

  const filteredRaw = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rawSourceProjects.filter((proj) => {
      const matchSearch =
        !q ||
        proj.name.toLowerCase().includes(q) ||
        proj.projectCode.toLowerCase().includes(q) ||
        proj.location.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || proj.status === statusFilter
      const matchLocation = locationFilter === 'all' || proj.location === locationFilter
      return matchSearch && matchStatus && matchLocation
    })
  }, [locationFilter, rawSourceProjects, searchQuery, statusFilter])

  const { valid: validProjects, invalidOrMissing } = useMemo(
    () => partitionProjectsByCoordinates(filteredRaw),
    [filteredRaw],
  )

  const selectedProject = useMemo(
    () => validProjects.find((p) => p.id === selectedProjectId) ?? null,
    [selectedProjectId, validProjects],
  )

  function handleResetMapView() {
    setSelectedProjectId(null)
    setResetSignal((n) => n + 1)
  }

  function handleResetFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setLocationFilter('all')
    setSelectedProjectId(null)
    setResetSignal((n) => n + 1)
  }

  const hasFilters =
    Boolean(searchQuery) || statusFilter !== 'all' || locationFilter !== 'all'

  const directoryColumns: TableColumn<ValidMapProject>[] = [
    {
      key: 'projectCode',
      header: 'Project ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">
          {row.projectCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Project Name',
      render: (row) => <span className="font-semibold text-editorial-blue">{row.name}</span>,
    },
    {
      key: 'location',
      header: 'Location & Coordinates',
      render: (row) => (
        <span className="text-xs text-charcoal">
          {row.location} ({row.latitude.toFixed(3)}, {row.longitude.toFixed(3)})
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
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
      key: 'action',
      header: 'Map Action',
      align: 'right',
      render: (row) => (
        <Button
          size="sm"
          variant={row.id === selectedProjectId ? 'primary' : 'outline'}
          onClick={() => setSelectedProjectId(row.id)}
        >
          {row.id === selectedProjectId ? 'Selected on Map' : 'Focus Marker'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core Workspace"
        title="Interactive Project Maps"
        description="Explore infrastructure project locations on free OpenStreetMap tiles paired with live site weather and ML duration probes."
        breadcrumbs={[{ label: 'Project Maps' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {apiHealth.status === 'ready' && apiHealth.data ? (
              <Badge variant="success" showDot>
                API {apiHealth.data.version}: {apiHealth.data.status}
              </Badge>
            ) : (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              isLoading={apiHealth.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => setHealthNonce((n) => n + 1)}
            >
              Check Backend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Compass className="h-3.5 w-3.5" />}
              onClick={handleResetMapView}
            >
              Reset Map View
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Box className="h-3.5 w-3.5" />}
              onClick={() => navigate('/3d-twin')}
            >
              3D Digital Twin
            </Button>
          </div>
        }
      />

      {/* Transparent Location Data Provenance Notice */}
      <Card variant="sand" padding="sm">
        <div className="flex flex-wrap items-start justify-between gap-3 text-xs text-charcoal">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="text-editorial-blue">Location Data Provenance:</strong>{' '}
              <code>Live SQLite Database</code> loads persisted records from{' '}
              <code>GET /api/v1/projects</code> (scoped by your RBAC role; rows marked{' '}
              <code>DEMO</code> remain sample coordinates). Selecting any marker queries live{' '}
              <code>GET /weather</code> and <code>POST /predict</code>.
            </p>
          </div>
          <Badge variant={dataSource === 'backend' ? 'info' : 'warning'}>
            {dataSource === 'backend'
              ? `Live SQLite: ${rawSourceProjects.length} Mapped`
              : 'Static Demo Fallback'}
          </Badge>
        </div>
      </Card>

      {/* Filters & Data Source Toolbar */}
      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2">
            <Select
              label="Coordinate Data Source"
              options={SOURCE_OPTIONS}
              value={dataSource}
              onChange={(e) => {
                const next = e.target.value === 'backend' ? 'backend' : 'demo'
                setDataSource(next)
                setSelectedProjectId(null)
              }}
            />
          </div>

          <SearchField
            label="Search Site"
            value={searchQuery}
            onValueChange={(val) => {
              setSearchQuery(val)
              setSelectedProjectId(null)
            }}
            placeholder="Name, ID, or city..."
          />

          <Select
            label="Project Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setSelectedProjectId(null)
            }}
          />

          <Select
            label="Location"
            options={locationOptions}
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value)
              setSelectedProjectId(null)
            }}
          />

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="md"
              disabled={!hasFilters}
              onClick={handleResetFilters}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {dataSource === 'backend' && backendLoadError ? (
        <Card>
          <CardContent className="pt-0">
            <EmptyState
              title="Unable to Load Live SQLite Project Coordinates"
              description={backendLoadError}
              action={
                <Button variant="primary" onClick={() => setDataSource('demo')}>
                  Load Static Demo Markers
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : dataSource === 'backend' && rawSourceProjects.length === 0 ? (
        <Card>
          <CardContent className="pt-0">
            <EmptyState
              title="No Assigned Mapped Projects Found"
              description="No persisted SQLite projects with valid latitude/longitude coordinates matched your current role scope."
              action={
                <Button variant="primary" onClick={() => setDataSource('demo')}>
                  Preview Static Demo Markers
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Map + Legend + Side Inspector */}
          <div className="grid gap-6 xl:grid-cols-12">
            <Card className="xl:col-span-8 flex flex-col">
              <CardHeader>
                <div>
                  <CardTitle>Geospatial Infrastructure Map</CardTitle>
                  <CardDescription>
                    Showing {validProjects.length} validated project marker(s)
                    {invalidOrMissing.length > 0
                      ? ` (${invalidOrMissing.length} excluded due to missing/invalid coordinates)`
                      : ''}
                    .
                  </CardDescription>
                </div>

                {/* Map Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-charcoal">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-editorial-blue border border-surface" aria-hidden="true" />
                    Active
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-coral border border-surface" aria-hidden="true" />
                    Attention Required
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-sage border border-surface" aria-hidden="true" />
                    Completed
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <LeafletProjectMap
                  projects={validProjects}
                  selectedProjectId={selectedProjectId}
                  resetSignal={resetSignal}
                  onSelectProject={(proj) => setSelectedProjectId(proj ? proj.id : null)}
                />

                <p className="text-[11px] text-charcoal/75">
                  Map tiles provided free of charge under OpenStreetMap&apos;s Tile Usage Policy
                  (&copy; OpenStreetMap contributors). Coordinates are validated cleanly before
                  plotting; dedicated numeric delay-risk score filtering will activate once backend
                  project risk persistence is added.
                </p>
              </CardContent>
            </Card>

            <div className="xl:col-span-4">
              <ProjectMapInspectorCard
                project={selectedProject}
                onClearSelection={() => setSelectedProjectId(null)}
                onZoomToProject={() => setResetSignal((n) => n + 1)}
              />
            </div>
          </div>

          {/* Accessible Keyboard-Friendly Site Directory */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mapped Project Locations Directory</CardTitle>
                <CardDescription>
                  Keyboard-accessible list synchronized with map filters and marker focus.
                </CardDescription>
              </div>
              <Badge variant="warning">DEMO DATA</Badge>
            </CardHeader>
            <CardContent>
              <Table
                caption="Project locations displayed on interactive map"
                columns={directoryColumns}
                data={validProjects}
                rowKey={(row) => row.id}
                emptyTitle="No matching project coordinates"
                emptyDescription="Reset search, status, or location filters to display markers."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
