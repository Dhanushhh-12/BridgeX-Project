/**
 * Safe WebGL capability detection for progressive enhancement & fallback rendering.
 */
export function detectWebGLSupport(): {
  supported: boolean
  contextKind: 'webgl2' | 'webgl' | 'none'
  reason: string | null
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      contextKind: 'none',
      reason: 'Browser DOM is unavailable.',
    }
  }

  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
    if (gl2) {
      return { supported: true, contextKind: 'webgl2', reason: null }
    }
    const gl1 =
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false })
    if (gl1) {
      return { supported: true, contextKind: 'webgl', reason: null }
    }
    return {
      supported: false,
      contextKind: 'none',
      reason: 'WebGL hardware or software rendering context could not be initialized on this browser.',
    }
  } catch (err) {
    return {
      supported: false,
      contextKind: 'none',
      reason: err instanceof Error ? err.message : 'WebGL initialization failed.',
    }
  }
}
