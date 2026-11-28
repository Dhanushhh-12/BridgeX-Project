import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiClientError,
  configureAuthClient,
  getCurrentProfile,
  postLogin,
  postLogout,
  postRegister,
} from '../services/apiClient'
import type {
  AuthSessionResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  UserRole,
} from '../types/api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './useAuth'

const TOKEN_KEY = 'bridgex_auth_token'
const EXPIRES_KEY = 'bridgex_auth_expires_at'
const USER_KEY = 'bridgex_auth_user'

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function readStoredExpiry(): string | null {
  try {
    return window.localStorage.getItem(EXPIRES_KEY)
  } catch {
    return null
  }
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function persistSession(session: AuthSessionResponse): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, session.access_token)
    window.localStorage.setItem(EXPIRES_KEY, session.expires_at)
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
  } catch {
    // Ignore storage quota issues
  }
}

function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(EXPIRES_KEY)
    window.localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore
  }
}

function isIsoExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const parsed = Date.parse(expiresAt)
  return Number.isFinite(parsed) && parsed <= Date.now()
}

function getInitialAuthState(): {
  status: AuthStatus
  token: string | null
  expiresAt: string | null
  user: AuthUser | null
  sessionMessage: string | null
} {
  const storedToken = readStoredToken()
  const storedExpiry = readStoredExpiry()
  if (!storedToken) {
    return {
      status: 'unauthenticated',
      token: null,
      expiresAt: null,
      user: null,
      sessionMessage: null,
    }
  }
  if (isIsoExpired(storedExpiry)) {
    clearStoredSession()
    return {
      status: 'unauthenticated',
      token: null,
      expiresAt: null,
      user: null,
      sessionMessage: 'Your previous session expired. Please sign in again.',
    }
  }
  return {
    status: 'initializing',
    token: storedToken,
    expiresAt: storedExpiry,
    user: readStoredUser(),
    sessionMessage: null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(getInitialAuthState)
  const [status, setStatus] = useState<AuthStatus>(initial.status)
  const [token, setToken] = useState<string | null>(initial.token)
  const [expiresAt, setExpiresAt] = useState<string | null>(initial.expiresAt)
  const [user, setUser] = useState<AuthUser | null>(initial.user)
  const [sessionMessage, setSessionMessage] = useState<string | null>(initial.sessionMessage)

  const tokenRef = useRef<string | null>(initial.token)

  useEffect(() => {
    tokenRef.current = token
  }, [token])

  const forceSignOut = useCallback((reason?: string) => {
    clearStoredSession()
    tokenRef.current = null
    setToken(null)
    setExpiresAt(null)
    setUser(null)
    setStatus('unauthenticated')
    if (reason) {
      setSessionMessage(reason)
    }
  }, [])

  useEffect(() => {
    configureAuthClient({
      getToken: () => tokenRef.current,
      onUnauthorized: (reason) => {
        forceSignOut(reason || 'Your session expired or was signed out. Please sign in again.')
      },
    })
  }, [forceSignOut])

  // Verify existing stored token against FastAPI on startup
  useEffect(() => {
    if (status !== 'initializing') return
    let cancelled = false

    getCurrentProfile()
      .then((res) => {
        if (!cancelled) {
          setUser(res.user)
          try {
            window.localStorage.setItem(USER_KEY, JSON.stringify(res.user))
          } catch {
            // Ignore
          }
          setStatus('authenticated')
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiClientError && err.status === 401) {
          forceSignOut(err.message)
          return
        }
        const cached = readStoredUser()
        if (cached && !isIsoExpired(readStoredExpiry())) {
          setUser(cached)
          setStatus('authenticated')
        } else {
          forceSignOut('Unable to validate your session. Please sign in again.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [forceSignOut, status])

  // Proactive session expiration timer
  useEffect(() => {
    if (status !== 'authenticated' || !expiresAt) return
    const msLeft = Math.max(0, Date.parse(expiresAt) - Date.now())
    if (!Number.isFinite(msLeft)) return
    const clampedMs = Math.min(msLeft, 2147483647)
    const timer = window.setTimeout(() => {
      forceSignOut('Your session has expired. Please sign in again.')
    }, clampedMs)
    return () => window.clearTimeout(timer)
  }, [expiresAt, forceSignOut, status])

  const applySession = useCallback((session: AuthSessionResponse) => {
    persistSession(session)
    tokenRef.current = session.access_token
    setToken(session.access_token)
    setExpiresAt(session.expires_at)
    setUser(session.user)
    setSessionMessage(null)
    setStatus('authenticated')
  }, [])

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthUser> => {
      const session = await postLogin(payload)
      applySession(session)
      return session.user
    },
    [applySession],
  )

  const register = useCallback(
    async (payload: RegisterPayload): Promise<AuthUser> => {
      const session = await postRegister(payload)
      applySession(session)
      return session.user
    },
    [applySession],
  )

  const logout = useCallback(async () => {
    try {
      if (tokenRef.current) {
        await postLogout()
      }
    } catch {
      // Clear local credentials cleanly even if token already expired
    } finally {
      forceSignOut('You have signed out cleanly.')
    }
  }, [forceSignOut])

  const refreshProfile = useCallback(async () => {
    const res = await getCurrentProfile()
    setUser(res.user)
    try {
      window.localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    } catch {
      // Ignore
    }
  }, [])

  const clearSessionMessage = useCallback(() => setSessionMessage(null), [])

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      expiresAt,
      sessionMessage,
      login,
      register,
      logout,
      refreshProfile,
      clearSessionMessage,
      hasRole,
    }),
    [
      clearSessionMessage,
      expiresAt,
      hasRole,
      login,
      logout,
      refreshProfile,
      register,
      sessionMessage,
      status,
      token,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
