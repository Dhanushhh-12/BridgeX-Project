import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  Box,
  Compass,
  Eye,
  Globe,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { PageHeader } from '../components/layout'
import {
  CAMERA_PRESETS,
  INFRASTRUCTURE_ZONES,
  ProjectInfoPanel,
  WebGLErrorBoundary,
  WebGLFallback,
  detectWebGLSupport,
  getPresetCamera,
  resolveProjectInfrastructureZones,
  type CameraCommand,
  type CameraPresetKey,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
  type SceneMode,
  type ValidGlobeProject,
} from '../components/three'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingIndicator,
  Select,
} from '../components/ui'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { getBackendProjectDetail, getBackendProjects } from '../services/apiClient'
import type { BackendTaskRecord, ManagedProjectRecord } from '../types/api'
import { partitionProjectsByCoordinates } from '../utils/geoValidation'

const LazyInfrastructureCanvas = lazy(() =>
  import('../components/three/InfrastructureCanvasViewport').then((m) => ({
    default: m.InfrastructureCanvasViewport,
  })),
)

export function ThreeVisualizationPage() {
  const reducedMotion = useReducedMotion()
  const viewportShellRef = useRef<HTMLDivElement | null>(null)

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  // WebGL & Fallback State
  const initialSupport = useMemo(() => detectWebGLSupport(), [])
  const [force2DFallback, setForce2DFallback] = useState<boolean>(!initialSupport.supported)
  const [fallbackReason, setFallbackReason] = useState<string | null>(initialSupport.reason)

  // Real Backend State
  const [projectsState, setProjectsState] = useState<{
    status: 'loading' | 'ready' | 'error'
    projects: ManagedProjectRecord[]
    error: string | null
  }>({ status: 'loading', projects: [], error: null })
  const [reloadNonce, setReloadNonce] = useState<number>(0)

  const [selectedProjectCode, setSelectedProjectCode] = useState<string>('')
  const [detailTasks, setDetailTasks] = useState<BackendTaskRecord[]>([])
  const [detailLoading, setDetailLoading] = useState<boolean>(false)

  // 3D Scene Interaction State
  const [sceneMode, setSceneMode] = useState<SceneMode>('infrastructure')
  const [selectedZoneId, setSelectedZoneId] = useState<InfrastructureZoneId | null>('steel')
  const [hoveredZoneId, setHoveredZoneId] = useState<InfrastructureZoneId | null>(null)
  const [autoRotate, setAutoRotate] = useState<boolean>(false)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    nonce: 0,
    kind: 'preset',
    position: CAMERA_PRESETS.overview.position,
    target: CAMERA_PRESETS.overview.target,
  })

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768)
    }
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    window.addEventListener('resize', handleResize)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Fetch all persisted SQLite projects
  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) {
        setProjectsState((prev) => ({ ...prev, status: 'loading', error: null }))
      }
    })

    getBackendProjects()
      .then((res) => {
        if (cancelled) return
        setProjectsState({ status: 'ready', projects: res.projects, error: null })
        setSelectedProjectCode((current) => {
          if (current && res.projects.some((p) => p.project_code === current)) {
            return current
          }
          return res.projects[0]?.project_code ?? ''
        })
      })
      .catch((err) => {
        if (cancelled) return
        setProjectsState({
          status: 'error',
          projects: [],
          error: err instanceof Error ? err.message : 'Unable to fetch projects from FastAPI.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [reloadNonce])

  // Fetch tasks for the currently selected project
  useEffect(() => {
    if (!selectedProjectCode) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setDetailLoading(true)
    })

    getBackendProjectDetail(selectedProjectCode)
      .then((res) => {
        if (!cancelled) {
          setDetailTasks(res.tasks)
          setDetailLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailTasks([])
          setDetailLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedProjectCode])

  const selectedProject = useMemo(
    () => projectsState.projects.find((p) => p.project_code === selectedProjectCode) ?? null,
    [projectsState.projects, selectedProjectCode],
  )

  const resolvedZones = useMemo(
    () => resolveProjectInfrastructureZones(selectedProject, detailTasks),
    [detailTasks, selectedProject],
  )

  const zonesById = useMemo(() => {
    return resolvedZones.reduce(
      (acc, zone) => {
        acc[zone.id] = zone
        return acc
      },
      {} as Record<InfrastructureZoneId, ResolvedInfrastructureZone>,
    )
  }, [resolvedZones])

  const selectedZone = useMemo(
    () => resolvedZones.find((z) => z.id === selectedZoneId) ?? null,
    [resolvedZones, selectedZoneId],
  )

  const globeProjects: ValidGlobeProject[] = useMemo(() => {
    const mapped = projectsState.projects.map((p) => ({
      ...p,
      id: p.project_code,
    }))
    return partitionProjectsByCoordinates(mapped).valid.map((item) => ({
      ...item,
      id: Number(projectsState.projects.find((p) => p.project_code === item.project_code)?.id ?? 0),
    }))
  }, [projectsState.projects])

  const projectOptions = useMemo(() => {
    if (projectsState.projects.length === 0) {
      return [{ value: '', label: 'No projects available' }]
    }
    return projectsState.projects.map((p) => ({
      value: p.project_code,
      label: `${p.project_code} · ${p.name} (${p.actual_progress_pct}%)`,
    }))
  }, [projectsState.projects])

  const issueCameraPreset = useCallback(
    (preset: CameraPresetKey, modeOverride?: SceneMode) => {
      const cam = getPresetCamera(modeOverride ?? sceneMode, preset)
      setCameraCommand((prev) => ({
        nonce: prev.nonce + 1,
        kind: 'preset',
        position: cam.position,
        target: cam.target,
      }))
    },
    [sceneMode],
  )

  const focusZoneCamera = useCallback(
    (zoneId: InfrastructureZoneId) => {
      const zone = zonesById[zoneId]
      if (!zone) return
      setSceneMode('infrastructure')
      setCameraCommand((prev) => ({
        nonce: prev.nonce + 1,
        kind: 'focus',
        position: zone.cameraPosition,
        target: zone.focusTarget,
      }))
    },
    [zonesById],
  )

  const handleCameraStep = useCallback(
    (kind: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight') => {
      setCameraCommand((prev) => ({
        nonce: prev.nonce + 1,
        kind,
      }))
    },
    [],
  )

  const handleToggleFullscreen = useCallback(async () => {
    const el = viewportShellRef.current
    if (!el || !document.fullscreenEnabled) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      // Browser blocked fullscreen request; ignore silently
    }
  }, [])

  const handleModeSwitch = useCallback(
    (nextMode: SceneMode) => {
      setSceneMode(nextMode)
      issueCameraPreset('overview', nextMode)
    },
    [issueCameraPreset],
  )

  function handleViewportKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tag = (event.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      handleCameraStep('rotateLeft')
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      handleCameraStep('rotateRight')
    } else if (event.key === 'ArrowUp' || event.key === '+' || event.key === '=') {
      event.preventDefault()
      handleCameraStep('zoomIn')
    } else if (event.key === 'ArrowDown' || event.key === '-') {
      event.preventDefault()
      handleCameraStep('zoomOut')
    } else if (event.key === 'r' || event.key === 'R' || event.key === '0') {
      event.preventDefault()
      issueCameraPreset('overview')
    } else if (event.key >= '1' && event.key <= '8') {
      const idx = Number(event.key) - 1
      const zone = INFRASTRUCTURE_ZONES[idx]
      if (zone) {
        event.preventDefault()
        setSelectedZoneId(zone.id)
        focusZoneCamera(zone.id)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Core Workspace"
        title="3D Infrastructure Digital Twin"
        description="Interactive Three.js procedural structural twin and corridor coordinate globe synchronized with SQLite project and construction task records."
        breadcrumbs={[{ label: '3D Digital Twin' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={projectsState.status === 'loading'}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${projectsState.status === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh Data
            </Button>
            <Button
              type="button"
              variant={force2DFallback ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                if (force2DFallback) {
                  const recheck = detectWebGLSupport()
                  setForce2DFallback(!recheck.supported)
                  setFallbackReason(recheck.reason)
                } else {
                  setForce2DFallback(true)
                  setFallbackReason('2D architectural schematic mode selected manually.')
                }
              }}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {force2DFallback ? 'Switch to 3D View' : '2D Schematic Fallback'}
            </Button>
          </div>
        }
      />

      {/* Transparency & Data Grounding Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border-neutral bg-sand/45 px-4 py-2.5 text-xs text-charcoal">
        <div className="flex items-start gap-2 sm:items-center">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue sm:mt-0" aria-hidden="true" />
          <span>
            <strong>Illustrative Procedural 3D Geometry:</strong> Structural spans adapt to{' '}
            <code>project_type</code> while progress shading and risk badges reflect persisted SQLite
            rows from <code>GET /api/v1/projects</code>. Stages without logged task rows transparently
            derive fill from overall project completion.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <Box className="h-3 w-3" aria-hidden="true" />
            Three.js + R3F WebGL
          </Badge>
          {reducedMotion && <Badge variant="neutral">Reduced Motion Active</Badge>}
        </div>
      </div>

      {projectsState.status === 'error' && (
        <ErrorState
          title="Unable to Load Infrastructure Portfolio"
          message={projectsState.error || 'FastAPI /api/v1/projects did not respond.'}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Retry Connection
            </Button>
          }
        />
      )}

      {/* Project & Scene Controls Toolbar */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-5">
              <Select
                label="Active Infrastructure Project (SQLite)"
                value={selectedProjectCode}
                onChange={(e) => setSelectedProjectCode(e.target.value)}
                options={projectOptions}
                disabled={projectsState.status === 'loading'}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-7 md:justify-end">
              <div
                role="group"
                aria-label="3D visualization mode"
                className="inline-flex rounded-sm border border-border-neutral bg-ivory p-0.5"
              >
                <button
                  type="button"
                  onClick={() => handleModeSwitch('infrastructure')}
                  aria-pressed={sceneMode === 'infrastructure'}
                  className={`inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sceneMode === 'infrastructure'
                      ? 'bg-editorial-blue text-surface'
                      : 'text-editorial-blue hover:bg-sand'
                  }`}
                >
                  <Box className="h-3.5 w-3.5" aria-hidden="true" />
                  Structural Twin
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('globe')}
                  aria-pressed={sceneMode === 'globe'}
                  className={`inline-flex items-center gap-1.5 rounded-xs px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sceneMode === 'globe'
                      ? 'bg-editorial-blue text-surface'
                      : 'text-editorial-blue hover:bg-sand'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                  Corridor Globe ({globeProjects.length})
                </button>
              </div>

              {detailLoading && (
                <span className="text-xs text-charcoal/70">Syncing project tasks...</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main 3D Viewport + Info Panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          {force2DFallback ? (
            <WebGLFallback
              reason={fallbackReason}
              project={selectedProject}
              zones={resolvedZones}
              selectedZoneId={selectedZoneId}
              onSelectZone={(id) => setSelectedZoneId(id)}
              onRetryWebGL={() => {
                const check = detectWebGLSupport()
                setForce2DFallback(!check.supported)
                setFallbackReason(check.reason)
              }}
              projectsWithCoords={globeProjects}
              onSelectProject={(code) => setSelectedProjectCode(code)}
            />
          ) : (
            <div ref={viewportShellRef}>
            <Card
              className="flex flex-col overflow-hidden border-border-neutral bg-surface"
            >
              <CardHeader className="border-b border-border-neutral pb-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <Compass className="h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
                    <span className="truncate">
                      {sceneMode === 'infrastructure'
                        ? selectedProject
                          ? `${selectedProject.project_code} · ${selectedProject.project_type} 3D Twin`
                          : 'Procedural Bridge Structural Twin'
                        : '3D Infrastructure Corridor Globe'}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {sceneMode === 'infrastructure'
                      ? 'Drag to orbit, scroll to zoom, click any bridge zone, or use Arrow keys / + - / R / keys 1–8.'
                      : 'Click any coordinate beacon on the globe to inspect project details and switch the structural twin.'}
                  </CardDescription>
                </div>

                {/* Camera Action Controls */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCameraStep('zoomIn')}
                    aria-label="Zoom in 3D view"
                    title="Zoom In (+)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCameraStep('zoomOut')}
                    aria-label="Zoom out 3D view"
                    title="Zoom Out (-)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => issueCameraPreset('overview')}
                    aria-label="Reset 3D camera view"
                    title="Reset Camera (R)"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                  <Button
                    type="button"
                    variant={autoRotate && !reducedMotion ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={reducedMotion}
                    onClick={() => setAutoRotate((prev) => !prev)}
                    aria-pressed={autoRotate && !reducedMotion}
                    title={
                      reducedMotion
                        ? 'Auto-orbit disabled by prefers-reduced-motion'
                        : 'Toggle controlled auto-orbit'
                    }
                  >
                    {autoRotate && !reducedMotion ? (
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span className="hidden sm:inline">Orbit</span>
                  </Button>
                  {typeof document !== 'undefined' && document.fullscreenEnabled && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleToggleFullscreen}
                      aria-label={isFullscreen ? 'Exit fullscreen 3D view' : 'Enter fullscreen 3D view'}
                      title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Camera Presets Bar (Structural mode) */}
              {sceneMode === 'infrastructure' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-neutral bg-ivory/70 px-4 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bx-label mr-1">Camera Presets:</span>
                    {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => issueCameraPreset(key)}
                        className="rounded-xs border border-border-neutral bg-surface px-2.5 py-1 text-[11px] font-medium text-editorial-blue hover:bg-sand"
                      >
                        {CAMERA_PRESETS[key].label}
                      </button>
                    ))}
                  </div>
                  {hoveredZoneId && zonesById[hoveredZoneId] && (
                    <span className="font-medium text-editorial-blue">
                      Hover: {zonesById[hoveredZoneId].stageName} (
                      {zonesById[hoveredZoneId].progressPct}%)
                    </span>
                  )}
                </div>
              )}

              {/* Interactive WebGL Canvas Region */}
              <div
                tabIndex={0}
                role="region"
                aria-label={
                  sceneMode === 'infrastructure'
                    ? 'Interactive 3D infrastructure visualization viewport. Use arrow keys to rotate or zoom, plus and minus to zoom, R to reset, and number keys 1 through 8 to inspect construction stages.'
                    : 'Interactive 3D project corridor globe. Use arrow keys to rotate or zoom, R to reset.'
                }
                onKeyDown={handleViewportKeyDown}
                className={`relative w-full bg-ivory focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-editorial-blue ${
                  isFullscreen ? 'h-[75vh]' : 'h-[320px] sm:h-[420px] lg:h-[500px]'
                }`}
              >
                <WebGLErrorBoundary
                  fallback={(errReason) => (
                    <div className="h-full overflow-y-auto p-3">
                      <WebGLFallback
                        reason={errReason}
                        project={selectedProject}
                        zones={resolvedZones}
                        selectedZoneId={selectedZoneId}
                        onSelectZone={(id) => setSelectedZoneId(id)}
                        projectsWithCoords={globeProjects}
                        onSelectProject={(code) => setSelectedProjectCode(code)}
                      />
                    </div>
                  )}
                >
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center">
                        <LoadingIndicator label="Initializing 3D WebGL scene..." />
                      </div>
                    }
                  >
                    <LazyInfrastructureCanvas
                      mode={sceneMode}
                      projectType={selectedProject?.project_type ?? 'Arch Bridge'}
                      zonesById={zonesById}
                      selectedZoneId={selectedZoneId}
                      hoveredZoneId={hoveredZoneId}
                      onSelectZone={(id) => setSelectedZoneId(id)}
                      onHoverZone={(id) => setHoveredZoneId(id)}
                      globeProjects={globeProjects}
                      selectedProjectCode={selectedProjectCode || null}
                      onSelectProject={(code) => setSelectedProjectCode(code)}
                      autoRotate={autoRotate}
                      cameraCommand={cameraCommand}
                      isMobile={isMobile}
                      onWebGLContextLost={(reason) => {
                        setForce2DFallback(true)
                        setFallbackReason(reason)
                      }}
                    />
                  </Suspense>
                </WebGLErrorBoundary>

                {/* Non-intrusive HUD Overlay inside 3D Frame */}
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
                  <div className="pointer-events-auto rounded-sm border border-border-neutral bg-surface/92 px-3 py-1.5 text-[11px] text-charcoal shadow-xs backdrop-blur-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden="true" />
                        Completed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-editorial-blue"
                          aria-hidden="true"
                        />
                        In Progress
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-coral" aria-hidden="true" />
                        At Risk / Delayed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-border-neutral bg-sand"
                          aria-hidden="true"
                        />
                        Pending
                      </span>
                    </div>
                  </div>

                  {selectedProject && (
                    <div className="pointer-events-none rounded-sm border border-border-neutral bg-editorial-blue/92 px-3 py-1.5 text-[11px] font-medium text-surface shadow-xs">
                      {selectedProject.project_code} · {selectedProject.location} ·{' '}
                      <span className="bx-tabular font-mono">
                        {selectedProject.actual_progress_pct}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            </div>
          )}
        </div>

        {/* Accessible Side Project & Stage Information Panel */}
        <div className="xl:col-span-4">
          <ProjectInfoPanel
            project={selectedProject}
            zones={resolvedZones}
            selectedZone={selectedZone}
            onSelectZone={(id) => setSelectedZoneId(id)}
            onFocusZone={(id) => focusZoneCamera(id)}
          />
        </div>
      </div>
    </div>
  )
}
