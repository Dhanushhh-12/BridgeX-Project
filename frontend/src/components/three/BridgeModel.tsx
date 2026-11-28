import { useEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  DESIGN_PALETTE_HEX,
  getZoneColor,
  type InfrastructureZoneId,
  type ResolvedInfrastructureZone,
} from './sceneData'

export interface BridgeModelProps {
  projectType: string
  zonesById: Record<InfrastructureZoneId, ResolvedInfrastructureZone>
  selectedZoneId: InfrastructureZoneId | null
  hoveredZoneId: InfrastructureZoneId | null
  onSelectZone: (id: InfrastructureZoneId) => void
  onHoverZone: (id: InfrastructureZoneId | null) => void
}

export function BridgeModel({
  projectType,
  zonesById,
  selectedZoneId,
  hoveredZoneId,
  onSelectZone,
  onHoverZone,
}: BridgeModelProps) {
  const pilesRef = useRef<THREE.InstancedMesh | null>(null)
  const parapetPostsRef = useRef<THREE.InstancedMesh | null>(null)

  const pileGeometry = useMemo(() => new THREE.CylinderGeometry(0.18, 0.18, 1.4, 10), [])
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.1, 0.45, 0.08), [])

  const pilingZone = zonesById.piling
  const concreteZone = zonesById.concrete
  const steelZone = zonesById.steel
  const deckingZone = zonesById.decking
  const pavingZone = zonesById.paving
  const inspectionZone = zonesById.inspection

  const pileMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: getZoneColor(pilingZone.visualState, DESIGN_PALETTE_HEX.sage),
        roughness: 0.72,
        metalness: 0.15,
      }),
    [pilingZone.visualState],
  )

  const postMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: getZoneColor(inspectionZone.visualState, DESIGN_PALETTE_HEX.blue),
        roughness: 0.5,
        metalness: 0.4,
      }),
    [inspectionZone.visualState],
  )

  const archGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.4, 2.25, 0),
      new THREE.Vector3(-2.3, 4.45, 0),
      new THREE.Vector3(0, 5.2, 0),
      new THREE.Vector3(2.3, 4.45, 0),
      new THREE.Vector3(4.4, 2.25, 0),
    ])
    return new THREE.TubeGeometry(curve, 28, 0.17, 10, false)
  }, [])

  useEffect(() => {
    return () => {
      pileGeometry.dispose()
      postGeometry.dispose()
      archGeometry.dispose()
      pileMaterial.dispose()
      postMaterial.dispose()
    }
  }, [archGeometry, pileGeometry, pileMaterial, postGeometry, postMaterial])

  useEffect(() => {
    const mesh = pilesRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const pierXs = [-3.8, 3.8]
    const zOffsets = [-1.1, 0, 1.1]
    const xOffsets = [-0.45, 0.45]
    let index = 0
    for (const px of pierXs) {
      for (const xo of xOffsets) {
        for (const zo of zOffsets) {
          dummy.position.set(px + xo, -0.85, zo)
          dummy.updateMatrix()
          mesh.setMatrixAt(index++, dummy.matrix)
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useEffect(() => {
    const mesh = parapetPostsRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    let index = 0
    for (let i = -5; i <= 5; i++) {
      const x = i * 1.1
      dummy.position.set(x, 2.52, 1.62)
      dummy.updateMatrix()
      mesh.setMatrixAt(index++, dummy.matrix)
      dummy.position.set(x, 2.52, -1.62)
      dummy.updateMatrix()
      mesh.setMatrixAt(index++, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  function bindInteractive(zoneId: InfrastructureZoneId) {
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

  function highlightIntensity(zoneId: InfrastructureZoneId): number {
    if (selectedZoneId === zoneId) return 0.35
    if (hoveredZoneId === zoneId) return 0.2
    return 0
  }

  const normalizedType = projectType.toLowerCase()
  const isArchBridge = normalizedType.includes('arch')
  const isViaduct = normalizedType.includes('viaduct')
  const isOverpass = normalizedType.includes('overpass')
  const isPierRehab = normalizedType.includes('pier')

  const concreteColor = getZoneColor(concreteZone.visualState, DESIGN_PALETTE_HEX.sand)
  const steelColor = getZoneColor(steelZone.visualState, DESIGN_PALETTE_HEX.blue)
  const deckColor = getZoneColor(deckingZone.visualState, DESIGN_PALETTE_HEX.sand)
  const pavingColor = getZoneColor(pavingZone.visualState, DESIGN_PALETTE_HEX.charcoal)
  const inspectionColor = getZoneColor(inspectionZone.visualState, DESIGN_PALETTE_HEX.sage)

  const hangerOffsets = [-3.0, -2.0, -1.0, 0, 1.0, 2.0, 3.0]

  return (
    <group name="bridge-structural-twin">
      {/* Stage 3: Foundation Piling (Instanced Deep Caissons + Pile Caps) */}
      <group {...bindInteractive('piling')}>
        <instancedMesh ref={pilesRef} args={[pileGeometry, pileMaterial, 12]} castShadow />
        {[-3.8, 3.8].map((px) => (
          <mesh key={px} position={[px, -0.22, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.42, 3.2]} />
            <meshStandardMaterial
              color={getZoneColor(pilingZone.visualState, DESIGN_PALETTE_HEX.sage)}
              roughness={0.74}
              emissive={DESIGN_PALETTE_HEX.blue}
              emissiveIntensity={highlightIntensity('piling')}
            />
          </mesh>
        ))}
      </group>

      {/* Stage 4: Concrete Pouring (Main Piers, Crossheads & Rehabilitation Jackets) */}
      <group {...bindInteractive('concrete')}>
        {[-3.8, 3.8].map((px) => (
          <group key={px} position={[px, 0, 0]}>
            {/* Twin pier columns */}
            {[-0.95, 0.95].map((pz) => (
              <mesh key={pz} position={[0, 0.92, pz]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 2.0, 0.68]} />
                <meshStandardMaterial
                  color={concreteColor}
                  roughness={0.7}
                  emissive={DESIGN_PALETTE_HEX.coral}
                  emissiveIntensity={highlightIntensity('concrete')}
                />
              </mesh>
            ))}
            {/* Hammerhead crossbeam */}
            <mesh position={[0, 1.88, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.92, 0.36, 3.15]} />
              <meshStandardMaterial
                color={concreteColor}
                roughness={0.68}
                emissive={DESIGN_PALETTE_HEX.coral}
                emissiveIntensity={highlightIntensity('concrete')}
              />
            </mesh>
            {/* Extra pier collar visible for Pier Rehabilitation projects */}
            {isPierRehab && (
              <mesh position={[0, 0.38, 0]} castShadow>
                <boxGeometry args={[1.15, 0.65, 3.05]} />
                <meshStandardMaterial
                  color={DESIGN_PALETTE_HEX.coral}
                  roughness={0.55}
                  transparent
                  opacity={0.78}
                />
              </mesh>
            )}
          </group>
        ))}

        {/* Additional intermediate support column for Viaduct Deck */}
        {isViaduct && (
          <group position={[0, 0, 0]}>
            {[-0.95, 0.95].map((pz) => (
              <mesh key={pz} position={[0, 0.92, pz]} castShadow receiveShadow>
                <boxGeometry args={[0.64, 2.0, 0.64]} />
                <meshStandardMaterial color={concreteColor} roughness={0.7} />
              </mesh>
            ))}
            <mesh position={[0, 1.88, 0]} castShadow>
              <boxGeometry args={[0.88, 0.34, 3.1]} />
              <meshStandardMaterial color={concreteColor} roughness={0.68} />
            </mesh>
          </group>
        )}
      </group>

      {/* Stage 5: Steel Erection (Arch Ribs / Girders / Overpass Pylons) */}
      <group {...bindInteractive('steel')}>
        {isArchBridge && (
          <>
            {[-1.5, 1.5].map((zSide) => (
              <group key={zSide} position={[0, 0, zSide]}>
                <mesh geometry={archGeometry} castShadow>
                  <meshStandardMaterial
                    color={steelColor}
                    roughness={0.38}
                    metalness={0.55}
                    emissive={DESIGN_PALETTE_HEX.coral}
                    emissiveIntensity={highlightIntensity('steel')}
                  />
                </mesh>
                {hangerOffsets.map((hx) => {
                  const norm = hx / 4.4
                  const archTop = 2.25 + (1 - norm * norm) * 2.95
                  const hangerLen = Math.max(0.4, archTop - 2.2)
                  return (
                    <mesh key={hx} position={[hx, 2.2 + hangerLen / 2, 0]} castShadow>
                      <cylinderGeometry args={[0.035, 0.035, hangerLen, 6]} />
                      <meshStandardMaterial color={steelColor} metalness={0.65} roughness={0.32} />
                    </mesh>
                  )
                })}
              </group>
            ))}
            {/* Overhead arch lateral bracing */}
            {[-1.6, 0, 1.6].map((bx) => (
              <mesh key={bx} position={[bx, 4.85 - Math.abs(bx) * 0.25, 0]} castShadow>
                <boxGeometry args={[0.14, 0.14, 3.05]} />
                <meshStandardMaterial color={steelColor} metalness={0.6} roughness={0.35} />
              </mesh>
            ))}
          </>
        )}

        {!isArchBridge && (
          <>
            {/* Twin longitudinal steel box girders underneath the deck */}
            {[-1.05, 1.05].map((gz) => (
              <mesh key={gz} position={[0, 1.98, gz]} castShadow>
                <boxGeometry args={[12.2, 0.34, 0.32]} />
                <meshStandardMaterial
                  color={steelColor}
                  roughness={0.4}
                  metalness={0.55}
                  emissive={DESIGN_PALETTE_HEX.coral}
                  emissiveIntensity={highlightIntensity('steel')}
                />
              </mesh>
            ))}

            {/* Highway Overpass portal gantry frame */}
            {isOverpass && (
              <group position={[0, 2.2, 0]}>
                {[-1.72, 1.72].map((pz) => (
                  <mesh key={pz} position={[0, 1.15, pz]} castShadow>
                    <boxGeometry args={[0.24, 2.3, 0.24]} />
                    <meshStandardMaterial color={steelColor} metalness={0.58} roughness={0.36} />
                  </mesh>
                ))}
                <mesh position={[0, 2.32, 0]} castShadow>
                  <boxGeometry args={[0.36, 0.28, 3.68]} />
                  <meshStandardMaterial color={steelColor} metalness={0.58} roughness={0.36} />
                </mesh>
              </group>
            )}
          </>
        )}
      </group>

      {/* Stage 6: Bridge Decking (Main Structural Slab) */}
      <group {...bindInteractive('decking')}>
        <mesh position={[0, 2.16, 0]} castShadow receiveShadow>
          <boxGeometry args={[12.4, 0.24, 3.55]} />
          <meshStandardMaterial
            color={deckColor}
            roughness={0.68}
            transparent={deckingZone.visualState === 'pending'}
            opacity={deckingZone.visualState === 'pending' ? 0.65 : 1}
            emissive={DESIGN_PALETTE_HEX.blue}
            emissiveIntensity={highlightIntensity('decking')}
          />
        </mesh>
      </group>

      {/* Stage 7: Asphalt Paving (Carriageway & Centerline Striping) */}
      <group {...bindInteractive('paving')}>
        <mesh position={[0, 2.31, 0]} receiveShadow>
          <boxGeometry args={[12.4, 0.08, 3.05]} />
          <meshStandardMaterial
            color={pavingColor}
            roughness={0.88}
            transparent={pavingZone.visualState === 'pending'}
            opacity={pavingZone.visualState === 'pending' ? 0.55 : 1}
            emissive={DESIGN_PALETTE_HEX.coral}
            emissiveIntensity={highlightIntensity('paving')}
          />
        </mesh>
        {/* Centerline dashed markers */}
        {[-4.5, -2.7, -0.9, 0.9, 2.7, 4.5].map((lx) => (
          <mesh key={lx} position={[lx, 2.36, 0]}>
            <boxGeometry args={[0.85, 0.015, 0.1]} />
            <meshStandardMaterial color={DESIGN_PALETTE_HEX.ivory} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Stage 8: Structural Inspection (Edge Parapets, Instanced Posts & Telemetry Nodes) */}
      <group {...bindInteractive('inspection')}>
        <instancedMesh ref={parapetPostsRef} args={[postGeometry, postMaterial, 22]} />
        {[-1.62, 1.62].map((rz) => (
          <mesh key={rz} position={[0, 2.72, rz]}>
            <boxGeometry args={[12.2, 0.07, 0.09]} />
            <meshStandardMaterial
              color={inspectionColor}
              roughness={0.42}
              metalness={0.4}
              emissive={DESIGN_PALETTE_HEX.coral}
              emissiveIntensity={highlightIntensity('inspection')}
            />
          </mesh>
        ))}
        {/* Telemetry / Structural Health Monitoring Nodes */}
        {[-3.8, 0, 3.8].map((sx) => (
          <mesh key={sx} position={[sx, 2.88, 1.62]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial
              color={
                inspectionZone.visualState === 'completed'
                  ? DESIGN_PALETTE_HEX.sage
                  : DESIGN_PALETTE_HEX.coral
              }
              roughness={0.3}
              emissive={DESIGN_PALETTE_HEX.coral}
              emissiveIntensity={0.25 + highlightIntensity('inspection')}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
