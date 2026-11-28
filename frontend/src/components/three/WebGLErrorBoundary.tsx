import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface WebGLErrorBoundaryProps {
  children: ReactNode
  fallback: (errorReason: string) => ReactNode
}

interface WebGLErrorBoundaryState {
  hasError: boolean
  errorReason: string
}

/**
 * Catches WebGL context creation crashes or Three.js runtime errors and renders
 * the accessible 2D schematic fallback without crashing the dashboard.
 */
export class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  state: WebGLErrorBoundaryState = {
    hasError: false,
    errorReason: '',
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return {
      hasError: true,
      errorReason: error.message || 'WebGL 3D renderer failed to initialize.',
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Handled cleanly via fallback state UI
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.errorReason)
    }
    return this.props.children
  }
}
