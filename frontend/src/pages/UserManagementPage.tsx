import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  LoadingIndicator,
  Select,
  Table,
  type TableColumn,
} from '../components/ui'
import { useAuth } from '../context/useAuth'
import {
  deleteManagedUser,
  getManagedUsers,
  patchManagedUser,
  postManagedUser,
} from '../services/apiClient'
import type { AuthUser, UserRole } from '../types/api'

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer (Read-Only)' },
  { value: 'project_manager', label: 'Project Manager (Assigned Projects)' },
  { value: 'administrator', label: 'Administrator (Full Governance)' },
]

export function UserManagementPage() {
  const { user: currentUser, refreshProfile } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [newFullName, setNewFullName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('project_manager')
  const [newProjectsCsv, setNewProjectsCsv] = useState('BX-DEMO-001,BX-DEMO-002')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    getManagedUsers()
      .then((res) => {
        if (!cancelled) {
          setUsers(res.users)
          setLoadError(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to fetch user directory.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshNonce])

  function reloadDirectory() {
    setLoading(true)
    setRefreshNonce((n) => n + 1)
  }

  async function handleCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setActionMsg(null)
    setActionError(null)
    setCreating(true)
    try {
      const assigned = newProjectsCsv
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
      const res = await postManagedUser({
        full_name: newFullName.trim(),
        username: newUsername.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        assigned_projects: assigned,
        is_active: true,
      })
      setActionMsg(`Created ${res.user.role_label} account '${res.user.username}'.`)
      setNewFullName('')
      setNewUsername('')
      setNewEmail('')
      setNewPassword('')
      reloadDirectory()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create user account.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(targetUser: AuthUser, nextRole: UserRole) {
    setActionMsg(null)
    setActionError(null)
    try {
      await patchManagedUser(targetUser.id, { role: nextRole })
      setActionMsg(`Updated role for '${targetUser.username}' to ${nextRole}.`)
      reloadDirectory()
      if (currentUser?.id === targetUser.id) {
        await refreshProfile()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Role update failed.')
    }
  }

  async function handleToggleActive(targetUser: AuthUser) {
    setActionMsg(null)
    setActionError(null)
    try {
      await patchManagedUser(targetUser.id, { is_active: !targetUser.is_active })
      setActionMsg(
        `${targetUser.is_active ? 'Deactivated' : 'Activated'} account '${targetUser.username}'.`,
      )
      reloadDirectory()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Account status update failed.')
    }
  }

  async function handleDeleteUser(targetUser: AuthUser) {
    setActionMsg(null)
    setActionError(null)
    try {
      await deleteManagedUser(targetUser.id)
      setActionMsg(`Deleted user '${targetUser.username}'.`)
      reloadDirectory()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete user failed.')
    }
  }

  const columns: TableColumn<AuthUser>[] = [
    {
      key: 'identity',
      header: 'User Account',
      render: (row) => (
        <div>
          <p className="font-semibold text-editorial-blue">{row.full_name}</p>
          <p className="font-mono text-[11px] text-charcoal/75">
            {row.username} · {row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      render: (row) => (
        <select
          aria-label={`Role for ${row.username}`}
          disabled={row.id === currentUser?.id}
          value={row.role}
          onChange={(e) => void handleRoleChange(row, e.target.value as UserRole)}
          className="h-8 rounded-sm border border-border-neutral bg-surface px-2 text-xs text-editorial-blue disabled:bg-sand/60"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'projects',
      header: 'Assigned Projects',
      render: (row) => (
        <span className="font-mono text-[11px] text-charcoal/80">
          {row.role === 'administrator'
            ? 'ALL (Admin)'
            : row.assigned_projects.length > 0
              ? row.assigned_projects.join(', ')
              : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'critical'} showDot>
          {row.is_active ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Controls',
      render: (row) => {
        const isSelf = row.id === currentUser?.id
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSelf}
              onClick={() => void handleToggleActive(row)}
            >
              {row.is_active ? 'Disable' : 'Enable'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={isSelf}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => void handleDeleteUser(row)}
            >
              Remove
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator Governance"
        title="User & Role Management"
        description="Provision accounts, assign infrastructure project scopes, and enforce backend role permissions."
        breadcrumbs={[{ label: 'User Management' }]}
        actions={
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={reloadDirectory}
          >
            Refresh Directory
          </Button>
        }
      />

      {actionMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-sm border border-sage bg-surface px-4 py-2.5 text-xs font-medium text-editorial-blue"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
          <span>{actionMsg}</span>
        </div>
      )}

      {actionError && <ErrorState compact title="User Action Failed" message={actionError} />}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Provision New Account</CardTitle>
            <CardDescription>
              Administrator-only provisioning supporting Administrator, Project Manager, and Viewer
              roles.
            </CardDescription>
          </div>
          <Badge variant="info">
            <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" /> Admin Enforced
          </Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="grid gap-3 md:grid-cols-3">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Rajesh Nair"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
            />
            <Input
              label="Username"
              required
              placeholder="r.nair"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              required
              placeholder="r.nair@bridgex.org"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Input
              label="Temporary Password"
              type="password"
              required
              placeholder="Min 8 chars (letters + digits)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            />
            <Input
              label="Assigned Project Codes"
              placeholder="BX-DEMO-001, BX-DEMO-002"
              value={newProjectsCsv}
              onChange={(e) => setNewProjectsCsv(e.target.value)}
            />
            <div className="flex items-end md:col-span-3">
              <Button
                type="submit"
                variant="primary"
                isLoading={creating}
                leftIcon={<UserPlus className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Create Managed User
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Registered Workspace Accounts ({users.length})</CardTitle>
            <CardDescription>
              Password hashes are never returned by the FastAPI API.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingIndicator label="Loading registered users..." />
          ) : loadError ? (
            <ErrorState title="Could Not Load Users" message={loadError} />
          ) : (
            <Table
              caption="Registered AI Bridge X user accounts"
              columns={columns}
              data={users}
              rowKey={(row) => String(row.id)}
              emptyTitle="No user accounts found"
              emptyDescription="Provision a new Administrator, Project Manager, or Viewer above."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
