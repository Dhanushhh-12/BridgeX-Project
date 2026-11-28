import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import type { ManagedProjectRecord } from '../../types/api'
import { DESIGN_PALETTE_HEX, latLonToSpherePosition } from './sceneData'

export interface ValidGlobeProject extends ManagedProjectRecord {
  latitude: number
  longitude: number
}

export interface ProjectGlobeProps {
  projects: ValidGlobeProject[]
  selectedProjectCode: string | null
  onSelectProject: (projectCode: string) => void
  autoRotate: boolean
}

const GLOBE_RADIUS = 3.2

/**
 * Generates an editorial graticule & stylized landmass texture on an offscreen
 * HTML5 canvas without external tile dependencies or paid globe APIs.
 */
function createEditorialGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Ocean background in soft editorial slate-ivory tint
    ctx.fillStyle = '#E8DFD0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Subtle longitude/latitude grid lines
    ctx.strokeStyle = 'rgba(24, 49, 83, 0.16)'
    ctx.lineWidth = 1
    for (let lon = -180; lon <= 180; lon += 15) {
      const x = ((lon + 180) / 360) * canvas.width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const y = ((90 - lat) / 180) * canvas.height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Equator highlight
    ctx.strokeStyle = 'rgba(24, 49, 83, 0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    // India / Eurasia / Major continental reference silhouettes (stylized editorial bands)
    const drawRegion = (pts: Array<[number, number]>, fill: string) => {
      ctx.fillStyle = fill
      ctx.beginPath()
      pts.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * canvas.width
        const y = ((90 - lat) / 180) * canvas.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fill()
    }

    // Simplified illustrative landmass silhouettes for spatial context
    drawRegion(
      [
        [68, 24],
        [78, 35],
        [96, 28],
        [89, 21],
        [81, 14],
        [77, 8],
        [72, 19],
      ],
      '#183153',
    )
    drawRegion(
      [
        [-10, 36],
        [30, 70],
        [140, 68],
        [135, 32],
        [105, 18],
        [60, 26],
        [38, 34],
      ],
      'rgba(24, 49, 83, 0.42)',
    )
    drawRegion(
      [
        [-16, 32],
        [34, 32],
        [48, 10],
        [36, -30],
        [18, -34],
        [8, 4],
        [-16, 15],
      ],
      'rgba(24, 49, 83, 0.38)',
    )
    drawRegion(
      [
        [-130, 55],
        [-60, 50],
        [-80, 22],
        [-108, 20],
        [-124, 42],
      ],
      'rgba(24, 49, 83, 0.36)',
    )
    drawRegion(
      [
        [-78, 10],
        [-36, -6],
        [-54, -36],
        [-72, -52],
        [-80, -18],
      ],
      'rgba(24, 49, 83, 0.36)',
    )
    drawRegion(
      [
        [114, -22],
        [152, -16],
        [148, -38],
        [116, -34],
      ],
      'rgba(24, 49, 83, 0.36)',
    )
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function ProjectGlobe({
  projects,
  selectedProjectCode,
  onSelectProject,
  autoRotate,
}: ProjectGlobeProps) {
  const groupRef = useRef<THREE.Group | null>(null)
  const reducedMotion = useReducedMotion()
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  const globeTexture = useMemo(() => createEditorialGlobeTexture(), [])

  // Rotate globe initially so India corridor (lon ~79E, lat ~17N) faces the camera
  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    // Camera sits at +Z/+X; adjust initial Y rotation so (17N, 79E) faces viewer
    group.rotation.y = -0.35
    group.rotation.x = 0.24
  }, [])

  useEffect(() => {
    return () => {
      globeTexture.dispose()
    }
  }, [globeTexture])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group || !autoRotate || reducedMotion) return
    group.rotation.y += delta * 0.14
  })

  const markerItems = useMemo(() => {
    return projects.map((proj) => {
      const surfacePos = latLonToSpherePosition(proj.latitude, proj.longitude, GLOBE_RADIUS)
      const normal = new THREE.Vector3(...surfacePos).normalize()
      const beaconPos = normal.clone().multiplyScalar(GLOBE_RADIUS + 0.14)
      return {
        project: proj,
        position: [beaconPos.x, beaconPos.y, beaconPos.z] as [number, number, number],
      }
    })
  }, [projects])

  // Build corridor connection arcs between consecutive valid projects
  const corridorLine = useMemo(() => {
    if (projects.length < 2) return null
    const points: THREE.Vector3[] = []
    for (let i = 0; i < projects.length - 1; i++) {
      const start = new THREE.Vector3(
        ...latLonToSpherePosition(projects[i].latitude, projects[i].longitude, GLOBE_RADIUS + 0.04),
      )
      const end = new THREE.Vector3(
        ...latLonToSpherePosition(
          projects[i + 1].latitude,
          projects[i + 1].longitude,
          GLOBE_RADIUS + 0.04,
        ),
      )
      const mid = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(GLOBE_RADIUS + 0.32)
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      points.push(...curve.getPoints(12))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({
      color: DESIGN_PALETTE_HEX.coral,
      transparent: true,
      opacity: 0.55,
    })
    return new THREE.Line(geo, mat)
  }, [projects])

  useEffect(() => {
    return () => {
      if (corridorLine) {
        corridorLine.geometry.dispose()
        ;(corridorLine.material as THREE.Material).dispose()
      }
    }
  }, [corridorLine])

  function markerColor(status: ManagedProjectRecord['status']): string {
    if (status === 'At Risk') return DESIGN_PALETTE_HEX.coral
    if (status === 'Completed') return DESIGN_PALETTE_HEX.sage
    return DESIGN_PALETTE_HEX.blue
  }

  return (
    <group ref={groupRef} name="project-network-globe">
      {/* Main Globe Sphere */}
      <mesh receiveShadow>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 32]} />
        <meshStandardMaterial
          map={globeTexture}
          roughness={0.78}
          metalness={0.08}
        />
      </mesh>

      {/* Outer atmospheric border ring */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS + 0.025, 36, 24]} />
        <meshBasicMaterial
          color={DESIGN_PALETTE_HEX.blue}
          wireframe
          transparent
          opacity={0.06}
        />
      </mesh>

      {/* Corridor connection line */}
      {corridorLine && <primitive object={corridorLine} />}

      {/* Interactive Project Markers using actual persisted coordinates */}
      {markerItems.map(({ project, position }) => {
        const isSelected = selectedProjectCode === project.project_code
        const isHovered = hoveredCode === project.project_code
        const scale = isSelected ? 1.45 : isHovered ? 1.25 : 1.0

        return (
          <mesh
            key={project.project_code}
            position={position}
            scale={scale}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              onSelectProject(project.project_code)
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
              setHoveredCode(project.project_code)
            }}
            onPointerOut={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation()
              document.body.style.cursor = 'auto'
              setHoveredCode(null)
            }}
          >
            <sphereGeometry args={[0.1, 14, 14]} />
            <meshStandardMaterial
              color={markerColor(project.status)}
              roughness={0.28}
              metalness={0.2}
              emissive={isSelected ? DESIGN_PALETTE_HEX.coral : DESIGN_PALETTE_HEX.blue}
              emissiveIntensity={isSelected ? 0.55 : isHovered ? 0.35 : 0.15}
            />
          </mesh>
        )
      })}
    </group>
  )
}
