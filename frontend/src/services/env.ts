/**
 * Safe public environment helper for the AI Bridge X frontend.
 * Only reads non-secret VITE_* variables exposed intentionally to the browser.
 */
const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(
  /\/+$/,
  '',
)

export const frontendEnv = {
  appName: import.meta.env.VITE_APP_NAME || 'AI Bridge X',
  apiBaseUrl: configuredBaseUrl,
  // Use Vite's /api dev proxy in local development so FastAPI calls succeed without CORS changes
  requestBaseUrl: import.meta.env.DEV ? '/api' : configuredBaseUrl,
} as const
