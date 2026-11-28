import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import type { DemoProjectRecord } from '../../data/demoOverviewData'
import { Badge, Button, EmptyState } from '../ui'

export interface ValidMapProject extends DemoProjectRecord {
  latitude: number
  longitude: number
}

export interface LeafletProjectMapProps {
  projects: ValidMapProject[]
  selectedProjectId: string | null
  resetSignal: number
  onSelectProject: (project: ValidMapProject | null) => void
}

const DEFAULT_CENTER: [number, number] = [17.05, 79.8]
const DEFAULT_ZOOM = 7

function getStatusColor(status: DemoProjectRecord['status']): string {
  if (status === 'At Risk') return '#F0785F'
  if (status === 'Completed') return '#8B9B91'
  return '#183153'
}

interface ViewportControllerProps {
  projects: ValidMapProject[]
  selectedProject: ValidMapProject | null
  resetSignal: number
}

function MapViewportController({
  projects,
  selectedProject,
  resetSignal,
}: ViewportControllerProps) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (selectedProject) {
      map.flyTo([selectedProject.latitude, selectedProject.longitude], 12, {
        animate: !reduceMotion,
        duration: reduceMotion ? 0 : 0.45,
      })
      return
    }

    if (projects.length > 0) {
      const bounds = L.latLngBounds(projects.map((p) => [p.latitude, p.longitude]))
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 11,
        animate: !reduceMotion,
      })
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false })
    }
  }, [map, projects, selectedProject, resetSignal])

  return null
}

export function LeafletProjectMap({
  projects,
  selectedProjectId,
  resetSignal,
  onSelectProject,
}: LeafletProjectMapProps) {
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  if (projects.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-sm border border-border-neutral bg-ivory/60 sm:h-[400px] lg:h-[460px]">
        <EmptyState
          title="No Valid Geographic Coordinates to Display"
          description="Either the selected data source has no persisted coordinates yet, or active search/status filters returned 0 valid coordinates."
        />
      </div>
    )
  }

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-sm border border-border-neutral bg-sand/40 sm:h-[400px] lg:h-[460px]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        scrollWheelZoom
        touchZoom
        dragging
        className="h-full w-full z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <ZoomControl position="topright" />

        <MapViewportController
          projects={projects}
          selectedProject={selectedProject}
          resetSignal={resetSignal}
        />

        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId
          const fill = getStatusColor(project.status)

          return (
            <CircleMarker
              key={project.id}
              center={[project.latitude, project.longitude]}
              radius={isSelected ? 12 : 9}
              pathOptions={{
                color: isSelected ? '#183153' : '#FFFFFF',
                weight: isSelected ? 3 : 2,
                fillColor: fill,
                fillOpacity: 0.92,
              }}
              eventHandlers={{
                click: () => onSelectProject(project),
              }}
            >
              <Popup>
                <div className="min-w-[180px] max-w-[240px] space-y-2 text-xs text-charcoal sm:min-w-[220px]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] font-semibold text-editorial-blue">
                        {project.projectCode}
                      </p>
                      <p className="text-sm font-semibold text-editorial-blue">{project.name}</p>
                    </div>
                    <Badge
                      variant={
                        project.status === 'At Risk'
                          ? 'critical'
                          : project.status === 'Completed'
                            ? 'success'
                            : 'info'
                      }
                    >
                      {project.status === 'At Risk' ? 'Attention Required' : project.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 border-t border-border-neutral pt-2 text-[11px]">
                    <p>
                      <strong>Location:</strong> {project.location} (
                      {project.latitude.toFixed(3)}, {project.longitude.toFixed(3)})
                    </p>
                    <p>
                      <strong>Manager:</strong> {project.manager ?? 'Not assigned (No DB)'}
                    </p>
                    <p>
                      <strong>Progress (Demo):</strong> {project.actualProgressPct}% (Plan{' '}
                      {project.plannedProgressPct}%)
                    </p>
                    <p>
                      <strong>Window (Demo):</strong> {project.startDate} &rarr;{' '}
                      {project.expectedCompletion}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Badge variant="warning">DEMO DATA</Badge>
                    <Link to={`/projects/${project.id}`}>
                      <Button size="sm" variant="secondary">
                        Project Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
