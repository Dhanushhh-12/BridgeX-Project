import { useEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DESIGN_PALETTE_HEX,
  getZoneColor,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
} from './sceneData'

export interface ConstructionSiteProps {
  zonesById: Record<InfrastructureZoneId, ResolvedInfrastructureZone>
  selectedZoneId: InfrastructureZoneId | null
  hoveredZoneId: InfrastructureZoneId | null
  onSelectZone: (id: InfrastructureZoneId) => void
  onHoverZone: (id: InfrastructureZoneId | null) => void
}

export function ConstructionSite({
  zonesById,
  selectedZoneId,
  hoveredZoneId,
  onSelectZone,
  onHoverZone,
}: ConstructionSiteProps) {
  const bollardsRef = useRef<THREE.InstancedMesh | null>(null)
  const bollardGeometry = useMemo(() => new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), [])
  const bollardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: DESIGN_PALETTE_HEX.coral,
        roughness: 0.45,
        metalness: 0.25,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      bollardGeometry.dispose()
      bollardMaterial.dispose()
    }
  }, [bollardGeometry, bollardMaterial])

  useEffect(() => {
    const mesh = bollardsRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const positions: Array<[number, number, number]> = [
      [-12.2, 2.35, -1.65],
      [-10.6, 2.35, -1.65],
      [-9.0, 2.35, -1.65],
      [-12.2, 2.35, 1.65],
      [-10.6, 2.35, 1.65],
      [-9.0, 2.35, 1.65],
      [9.0, 2.35, -1.65],
      [10.6, 2.35, -1.65],
      [12.2, 2.35, -1.65],
      [9.0, 2.35, 1.65],
      [10.6, 2.35, 1.65],
      [12.2, 2.35, 1.65],
    ]
    positions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  const sitePrepZone = zonesById['site-prep']
  const excavationZone = zonesById.excavation

  const sitePrepHighlight =
    selectedZoneId === 'site-prep' || hoveredZoneId === 'site-prep' ? 0.25 : 0
  const excavationHighlight =
    selectedZoneId === 'excavation' || hoveredZoneId === 'excavation' ? 0.28 : 0

  function makeHandlers(zoneId: InfrastructureZoneId) {
    return {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onSelectZone(zoneId)
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
        onHoverZone(zoneId)
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        document.body.style.cursor = 'auto'
        onHoverZone(null)
      },
    }
  }

  return (
    <group name="construction-site-environment">
      {/* River channel / corridor bed */}
      <mesh position={[0, -0.92, 0]} receiveShadow>
        <boxGeometry args={[32, 0.16, 18]} />
        <meshStandardMaterial color={DESIGN_PALETTE_HEX.sand} roughness={0.95} />
      </mesh>

      {/* Water channel strip */}
      <mesh position={[0, -0.78, 0]} receiveShadow>
        <boxGeometry args={[9.6, 0.14, 17.8]} />
        <meshStandardMaterial
          color={DESIGN_PALETTE_HEX.river}
          roughness={0.28}
          metalness={0.12}
          transparent
          opacity={0.82}
        />
      </mesh>

      {/* Site Preparation: Left & Right Embankments, Staging Yard, Depot Buildings */}
      <group {...makeHandlers('site-prep')}>
        {/* West bank & approach pad */}
        <mesh position={[-10.4, 0.52, 0]} receiveShadow castShadow>
          <boxGeometry args={[9.8, 2.75, 16]} />
          <meshStandardMaterial
            color={getZoneColor(sitePrepZone.visualState, DESIGN_PALETTE_HEX.sand)}
            roughness={0.86}
            emissive={DESIGN_PALETTE_HEX.blue}
            emissiveIntensity={sitePrepHighlight}
          />
        </mesh>

        {/* East bank & approach pad */}
        <mesh position={[10.4, 0.52, 0]} receiveShadow castShadow>
          <boxGeometry args={[9.8, 2.75, 16]} />
          <meshStandardMaterial
            color={getZoneColor(sitePrepZone.visualState, DESIGN_PALETTE_HEX.sand)}
            roughness={0.86}
            emissive={DESIGN_PALETTE_HEX.blue}
            emissiveIntensity={sitePrepHighlight}
          />
        </mesh>

        {/* Site staging modular buildings (north-west compound) */}
        <mesh position={[-10.8, 2.45, -4.8]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 1.15, 2.1]} />
          <meshStandardMaterial color={DESIGN_PALETTE_HEX.white} roughness={0.7} />
        </mesh>
        <mesh position={[-10.8, 3.06, -4.8]}>
          <boxGeometry args={[3.55, 0.12, 2.25]} />
          <meshStandardMaterial color={DESIGN_PALETTE_HEX.blue} roughness={0.55} />
        </mesh>
        <mesh position={[-7.6, 2.25, -4.9]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 0.78, 1.7]} />
          <meshStandardMaterial color={DESIGN_PALETTE_HEX.white} roughness={0.7} />
        </mesh>

        {/* Utility / Telemetry Substation (south-east corner) */}
        <mesh position={[10.6, 2.32, 4.6]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.9, 2.2]} />
          <meshStandardMaterial color={DESIGN_PALETTE_HEX.border} roughness={0.68} />
        </mesh>
        <mesh position={[10.6, 2.82, 4.6]}>
          <boxGeometry args={[2.7, 0.1, 2.3]} />
          <meshStandardMaterial color={DESIGN_PALETTE_HEX.charcoal} roughness={0.5} />
        </mesh>
      </group>

      {/* Excavation: Riverbank Cuts & Cofferdam Sheet Walls */}
      <group {...makeHandlers('excavation')}>
        {[-5.35, 5.35].map((bankX) => (
          <group key={bankX} position={[bankX, -0.1, 0]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[0.95, 1.45, 5.4]} />
              <meshStandardMaterial
                color={getZoneColor(excavationZone.visualState, DESIGN_PALETTE_HEX.sand)}
                roughness={0.82}
                emissive={DESIGN_PALETTE_HEX.coral}
                emissiveIntensity={excavationHighlight}
              />
            </mesh>
            {/* Cofferdam protective rim around pier zone */}
            <mesh position={[bankX < 0 ? 1.55 : -1.55, -0.42, 0]} receiveShadow>
              <boxGeometry args={[1.6, 0.55, 4.2]} />
              <meshStandardMaterial
                color={getZoneColor(excavationZone.visualState, DESIGN_PALETTE_HEX.border)}
                roughness={0.75}
                emissive={DESIGN_PALETTE_HEX.coral}
                emissiveIntensity={excavationHighlight}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Approach Carriageway Roads (West & East) */}
      <mesh position={[-10.6, 1.96, 0]} receiveShadow>
        <boxGeometry args={[9.4, 0.12, 3.6]} />
        <meshStandardMaterial color={DESIGN_PALETTE_HEX.charcoal} roughness={0.88} />
      </mesh>
      <mesh position={[10.6, 1.96, 0]} receiveShadow>
        <boxGeometry args={[9.4, 0.12, 3.6]} />
        <meshStandardMaterial color={DESIGN_PALETTE_HEX.charcoal} roughness={0.88} />
      </mesh>

      {/* Instanced Corridor Safety Bollards */}
      <instancedMesh
        ref={bollardsRef}
        args={[bollardGeometry, bollardMaterial, 12]}
        castShadow
      />
    </group>
  )
}
