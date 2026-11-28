import { createContext, useContext } from 'react'
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  UserRole,
} from '../types/api'

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  token: string | null
  expiresAt: string | null
  sessionMessage: string | null
  login: (payload: LoginPayload) => Promise<AuthUser>
  register: (payload: RegisterPayload) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearSessionMessage: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }
  return ctx
}
