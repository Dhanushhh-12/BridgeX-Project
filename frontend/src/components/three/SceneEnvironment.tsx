import { DESIGN_PALETTE_HEX } from './sceneData'

export interface SceneEnvironmentProps {
  isMobile?: boolean
  showGrid?: boolean
}

export function SceneEnvironment({ isMobile = false, showGrid = true }: SceneEnvironmentProps) {
  return (
    <>
      <color attach="background" args={[DESIGN_PALETTE_HEX.ivory]} />
      <fog attach="fog" args={[DESIGN_PALETTE_HEX.ivory, 26, 60]} />

      <hemisphereLight
        args={[DESIGN_PALETTE_HEX.white, DESIGN_PALETTE_HEX.sand, 1.1]}
      />
      <ambientLight intensity={0.45} color={DESIGN_PALETTE_HEX.ivory} />

      <directionalLight
        position={[14, 18, 12]}
        intensity={1.35}
        color="#FFF9F0"
        castShadow={!isMobile}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={48}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      <directionalLight position={[-12, 8, -10]} intensity={0.4} color="#D8E2EC" />

      {showGrid && (
        <gridHelper
          args={[36, 24, DESIGN_PALETTE_HEX.border, DESIGN_PALETTE_HEX.sand]}
          position={[0, -1.01, 0]}
        />
      )}
    </>
  )
}
