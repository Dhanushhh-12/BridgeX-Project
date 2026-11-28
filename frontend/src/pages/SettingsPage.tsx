import { useEffect, useState } from 'react'
import { Check, LogOut, Server, ShieldCheck, UserCircle2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui'
import { useAuth } from '../context/useAuth'
import { getSystemInfo } from '../services/apiClient'
import type { SystemInfoResponse } from '../types/api'

const PERMISSION_LABELS: Array<{ key: keyof NonNullable<ReturnType<typeof useAuth>['user']>['permissions']; label: string }> = [
  { key: 'can_manage_users', label: 'Manage users & assign roles' },
  { key: 'can_create_projects', label: 'Create or delete persisted project records' },
  { key: 'can_edit_projects', label: 'Update assigned project progress & status' },
  { key: 'can_run_predictions', label: 'Run ML duration predictions & CV inspection' },
  { key: 'can_access_analytics', label: 'View analytics & progress dashboards' },
  { key: 'can_export_reports', label: 'Preview and export PDF/CSV reports' },
]

export function SettingsPage() {
  const { user, expiresAt, logout } = useAuth()
  const navigate = useNavigate()
  const [sysInfo, setSysInfo] = useState<SystemInfoResponse | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSystemInfo()
      .then((res) => {
        if (!cancelled) setSysInfo(res)
      })
      .catch(() => {
        if (!cancelled) setSysInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance & Account"
        title="Profile & Security Settings"
        description="Inspect your authenticated identity, active JWT session expiry, backend role permissions, and FastAPI status."
        breadcrumbs={[{ label: 'Settings' }]}
        actions={
          <Button
            size="sm"
            variant="danger"
            isLoading={signingOut}
            leftIcon={<LogOut className="h-3.5 w-3.5" />}
            onClick={() => void handleSignOut()}
          >
            Sign Out
          </Button>
        }
      />

      {user && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue">
                  <UserCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>{user.full_name}</CardTitle>
                  <CardDescription>
                    @{user.username} · {user.email}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="info" showDot>
                {user.role_label}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                  <p className="bx-label">Account Status</p>
                  <p className="mt-1 font-semibold text-editorial-blue">
                    {user.is_active ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                  <p className="bx-label">JWT Expiration (UTC)</p>
                  <p className="mt-1 font-mono text-[11px] text-charcoal">
                    {expiresAt ? new Date(expiresAt).toLocaleString() : 'Active session'}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3">
                <p className="bx-label">Assigned Project Codes</p>
                <p className="mt-1 font-mono text-xs text-editorial-blue">
                  {user.role === 'administrator'
                    ? 'ALL PROJECTS (Administrator Scope)'
                    : user.assigned_projects.length > 0
                      ? user.assigned_projects.join(', ')
                      : 'Read-only workspace catalog'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
                <CardTitle>Enforced Role Permissions</CardTitle>
              </div>
              <Badge variant="neutral">{user.role}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {PERMISSION_LABELS.map((item) => {
                const allowed = user.permissions[item.key]
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-sm border border-border-neutral bg-ivory/40 px-3 py-2 text-xs"
                  >
                    <span className="text-charcoal">{item.label}</span>
                    {allowed ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-editorial-blue">
                        <Check className="h-3.5 w-3.5 text-sage" aria-hidden="true" /> Permitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-charcoal/60">
                        <X className="h-3.5 w-3.5 text-coral" aria-hidden="true" /> Restricted
                      </span>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      <Card variant="sand">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
            <CardTitle>Backend Security Runtime</CardTitle>
          </div>
          <Badge variant={sysInfo ? 'success' : 'warning'} showDot>
            {sysInfo ? sysInfo.backend_status : 'Offline'}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-charcoal/85">
          {sysInfo
            ? `${sysInfo.application_name} v${sysInfo.version} — JWT Bearer authentication (PyJWT HS256), Argon2id password hashing, and SQLite revocation active.`
            : 'Start FastAPI backend to verify live server info.'}
        </CardContent>
      </Card>
    </div>
  )
}
