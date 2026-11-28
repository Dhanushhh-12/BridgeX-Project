import { useEffect, useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { BridgeModel } from './BridgeModel'
import { ConstructionSite } from './ConstructionSite'
import { ProjectGlobe, type ValidGlobeProject } from './ProjectGlobe'
import {
  CAMERA_PRESETS,
  type CameraCommand,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
  type SceneMode,
} from './sceneData'
import { SceneEnvironment } from './SceneEnvironment'

export interface InfrastructureCanvasViewportProps {
  mode: SceneMode
  projectType: string
  zonesById: Record<InfrastructureZoneId, ResolvedInfrastructureZone>
  selectedZoneId: InfrastructureZoneId | null
  hoveredZoneId: InfrastructureZoneId | null
  onSelectZone: (id: InfrastructureZoneId) => void
  onHoverZone: (id: InfrastructureZoneId | null) => void
  globeProjects: ValidGlobeProject[]
  selectedProjectCode: string | null
  onSelectProject: (projectCode: string) => void
  autoRotate: boolean
  cameraCommand: CameraCommand
  isMobile: boolean
  onWebGLContextLost: (reason: string) => void
}

interface CameraRigProps {
  mode: SceneMode
  autoRotate: boolean
  reducedMotion: boolean
  cameraCommand: CameraCommand
}

function CameraRig({ mode, autoRotate, reducedMotion, cameraCommand }: CameraRigProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  const { camera, invalidate } = useThree()

  const goalPosRef = useRef<THREE.Vector3 | null>(null)
  const goalTargetRef = useRef<THREE.Vector3 | null>(null)
  const lastNonceRef = useRef<number>(0)

  useEffect(() => {
    if (cameraCommand.nonce === lastNonceRef.current) return
    lastNonceRef.current = cameraCommand.nonce
    const controls = controlsRef.current
    if (!controls) return

    if ((cameraCommand.kind === 'preset' || cameraCommand.kind === 'focus') && cameraCommand.position && cameraCommand.target) {
      const nextPos = new THREE.Vector3(...cameraCommand.position)
      const nextTarget = new THREE.Vector3(...cameraCommand.target)
      if (reducedMotion) {
        camera.position.copy(nextPos)
        controls.target.copy(nextTarget)
        controls.update()
        goalPosRef.current = null
        goalTargetRef.current = null
      } else {
        goalPosRef.current = nextPos
        goalTargetRef.current = nextTarget
      }
      invalidate()
      return
    }

    if (cameraCommand.kind === 'zoomIn' || cameraCommand.kind === 'zoomOut') {
      goalPosRef.current = null
      goalTargetRef.current = null
      const offset = camera.position.clone().sub(controls.target)
      const factor = cameraCommand.kind === 'zoomIn' ? 0.82 : 1.22
      const nextLength = THREE.MathUtils.clamp(offset.length() * factor, 4.8, 28)
      offset.setLength(nextLength)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      invalidate()
      return
    }

    if (cameraCommand.kind === 'rotateLeft' || cameraCommand.kind === 'rotateRight') {
      goalPosRef.current = null
      goalTargetRef.current = null
      const angle = cameraCommand.kind === 'rotateLeft' ? 0.25 : -0.25
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      invalidate()
    }
  }, [camera, cameraCommand, invalidate, reducedMotion])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    if (goalPosRef.current && goalTargetRef.current) {
      const alpha = 1 - Math.exp(-delta * 6.5)
      camera.position.lerp(goalPosRef.current, alpha)
      controls.target.lerp(goalTargetRef.current, alpha)
      controls.update()
      invalidate()

      if (
        camera.position.distanceTo(goalPosRef.current) < 0.05 &&
        controls.target.distanceTo(goalTargetRef.current) < 0.05
      ) {
        camera.position.copy(goalPosRef.current)
        controls.target.copy(goalTargetRef.current)
        controls.update()
        goalPosRef.current = null
        goalTargetRef.current = null
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.07}
      enablePan={mode === 'infrastructure'}
      autoRotate={autoRotate && !reducedMotion && mode === 'infrastructure'}
      autoRotateSpeed={0.55}
      minDistance={mode === 'globe' ? 5.2 : 5.5}
      maxDistance={mode === 'globe' ? 14.5 : 28}
      maxPolarAngle={mode === 'globe' ? Math.PI * 0.9 : Math.PI * 0.48}
      minPolarAngle={mode === 'globe' ? Math.PI * 0.1 : 0.12}
      onStart={() => {
        // Yield immediate manual control back to the user on drag/wheel
        goalPosRef.current = null
        goalTargetRef.current = null
      }}
    />
  )
}

export function InfrastructureCanvasViewport({
  mode,
  projectType,
  zonesById,
  selectedZoneId,
  hoveredZoneId,
  onSelectZone,
  onHoverZone,
  globeProjects,
  selectedProjectCode,
  onSelectProject,
  autoRotate,
  cameraCommand,
  isMobile,
  onWebGLContextLost,
}: InfrastructureCanvasViewportProps) {
  const reducedMotion = useReducedMotion()
  const shouldLoopContinuously = autoRotate && !reducedMotion

  return (
    <Canvas
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.25] : [1, 2]}
      frameloop={shouldLoopContinuously ? 'always' : 'demand'}
      camera={{
        position: mode === 'globe' ? [0, 2.2, 8.6] : CAMERA_PRESETS.overview.position,
        fov: 42,
        near: 0.1,
        far: 120,
      }}
      gl={{
        antialias: !isMobile,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        const handleLost = (event: Event) => {
          event.preventDefault()
          onWebGLContextLost('WebGL graphics context was lost or suspended by the browser.')
        }
        gl.domElement.addEventListener('webglcontextlost', handleLost, { once: true })
      }}
      onPointerMissed={() => {
        onHoverZone(null)
      }}
      className="h-full w-full"
    >
      <SceneEnvironment isMobile={isMobile} showGrid={mode === 'infrastructure'} />

      {mode === 'infrastructure' ? (
        <group>
          <ConstructionSite
            zonesById={zonesById}
            selectedZoneId={selectedZoneId}
            hoveredZoneId={hoveredZoneId}
            onSelectZone={onSelectZone}
            onHoverZone={onHoverZone}
          />
          <BridgeModel
            projectType={projectType}
            zonesById={zonesById}
            selectedZoneId={selectedZoneId}
            hoveredZoneId={hoveredZoneId}
            onSelectZone={onSelectZone}
            onHoverZone={onHoverZone}
          />
        </group>
      ) : (
        <ProjectGlobe
          projects={globeProjects}
          selectedProjectCode={selectedProjectCode}
          onSelectProject={onSelectProject}
          autoRotate={autoRotate}
        />
      )}

      <CameraRig
        mode={mode}
        autoRotate={autoRotate}
        reducedMotion={reducedMotion}
        cameraCommand={cameraCommand}
      />
    </Canvas>
  )
}
