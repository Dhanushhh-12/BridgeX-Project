import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import type { UserRole } from '../../types/api'
import { Button, Card, CardContent, LoadingIndicator } from '../ui'

export interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'initializing') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory p-6">
        <Card className="w-full max-w-md p-4">
          <LoadingIndicator label="Verifying authenticated AI Bridge X session..." />
        </Card>
      </div>
    )
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-coral bg-ivory text-editorial-blue">
              <ShieldAlert className="h-5 w-5 text-coral" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-editorial-blue">
                Access Restricted by Role Policy
              </h2>
              <p className="text-xs leading-relaxed text-charcoal/80">
                Your current role (<strong>{user.role_label}</strong>) does not have permission to
                view this workspace module. Permissions are enforced on both the frontend navigation
                and FastAPI backend.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/">
              <Button size="sm" variant="primary">
                Return to Overview
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
