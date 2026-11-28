import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, FolderPlus, Lock, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import {
  deleteProjectRecord,
  getBackendProjects,
  patchUpdateProject,
  postCreateProject,
} from '../../services/apiClient'
import type { ManagedProjectRecord } from '../../types/api'
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
} from '../ui'

export function ManagedProjectsPanel() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ManagedProjectRecord[]>([])
  const [scopedToAssigned, setScopedToAssigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Arch Bridge')
  const [newLocation, setNewLocation] = useState('Hyderabad')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBackendProjects()
      .then((res) => {
        if (!cancelled) {
          setProjects(res.projects)
          setScopedToAssigned(res.scoped_to_assigned)
          setErrorMsg(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to load backend project records.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshNonce])

  function reloadProjects() {
    setLoading(true)
    setRefreshNonce((n) => n + 1)
  }

  const canCreate = Boolean(user?.permissions.can_create_projects)
  const canEdit = Boolean(user?.permissions.can_edit_projects)
  const canDelete = Boolean(user?.permissions.can_delete_projects)

  async function handleCreateProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFeedbackMsg(null)
    setErrorMsg(null)
    setCreating(true)
    try {
      const res = await postCreateProject({
        project_code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        project_type: newType.trim(),
        location: newLocation.trim(),
        corridor: 'Managed Corridor',
        status: 'Active',
        planned_progress_pct: 10,
        actual_progress_pct: 10,
        notes: 'Created from authenticated Administrator workspace',
      })
      setFeedbackMsg(`Created backend project '${res.project.project_code}'.`)
      setNewCode('')
      setNewName('')
      reloadProjects()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project record.')
    } finally {
      setCreating(false)
    }
  }

  async function handleQuickProgressBump(proj: ManagedProjectRecord) {
    setFeedbackMsg(null)
    setErrorMsg(null)
    const nextActual = Math.min(100, Number(proj.actual_progress_pct) + 5)
    try {
      const res = await patchUpdateProject(proj.project_code, {
        actual_progress_pct: nextActual,
        status: nextActual >= 100 ? 'Completed' : proj.status,
      })
      setFeedbackMsg(
        `Updated '${res.project.project_code}' actual progress to ${res.project.actual_progress_pct}%.`,
      )
      reloadProjects()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Project update rejected by backend RBAC.')
    }
  }

  async function handleDeleteProject(projectCode: string) {
    setFeedbackMsg(null)
    setErrorMsg(null)
    try {
      await deleteProjectRecord(projectCode)
      setFeedbackMsg(`Deleted project '${projectCode}'.`)
      reloadProjects()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete rejected by backend RBAC.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Role-Protected Backend Project Records (SQLite)</CardTitle>
          <CardDescription>
            {scopedToAssigned
              ? 'Scoped to your Project Manager assignments. Unassigned projects are restricted on the backend.'
              : canEdit
                ? 'Full SQLite-backed project registry with backend role verification.'
                : 'Read-only Viewer mode: project mutations and user management are blocked on the backend.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={canEdit ? 'info' : 'neutral'} showDot>
            {user?.role_label ?? 'Viewer'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={reloadProjects}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!canEdit && (
          <div className="flex items-center gap-2 rounded-sm border border-border-neutral bg-sand/60 px-3.5 py-2.5 text-xs text-editorial-blue">
            <Lock className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
            <span>
              Viewer accounts can inspect projects and reports but cannot create, modify, or
              delete project records.
            </span>
          </div>
        )}

        {feedbackMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-sm border border-sage bg-ivory px-3.5 py-2 text-xs font-medium text-editorial-blue"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && <ErrorState compact title="Project Operation Error" message={errorMsg} />}

        {canCreate && (
          <form
            onSubmit={handleCreateProject}
            className="grid gap-3 rounded-sm border border-border-neutral bg-ivory/50 p-3.5 md:grid-cols-5"
          >
            <Input
              label="Code"
              required
              placeholder="BX-LIVE-008"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
            />
            <Input
              label="Project Name"
              required
              placeholder="Narmada Arch Span"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Select
              label="Type"
              options={[
                { value: 'Arch Bridge', label: 'Arch Bridge' },
                { value: 'Viaduct Deck', label: 'Viaduct Deck' },
                { value: 'Highway Overpass', label: 'Highway Overpass' },
              ]}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
            <Input
              label="Location"
              required
              placeholder="Hyderabad"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                size="md"
                variant="primary"
                isLoading={creating}
                leftIcon={<FolderPlus className="h-4 w-4" />}
                className="w-full"
              >
                Add Project
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <LoadingIndicator label="Loading SQLite project records..." />
        ) : projects.length === 0 ? (
          <p className="rounded-sm border border-border-neutral bg-ivory/40 px-4 py-3 text-xs text-charcoal/80">
            No backend project records are currently assigned to your account.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((proj) => (
              <div
                key={proj.project_code}
                className="flex flex-col justify-between gap-2 rounded-sm border border-border-neutral bg-ivory/40 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-editorial-blue">
                      {proj.project_code}
                    </span>
                    <h4 className="text-sm font-semibold text-editorial-blue">{proj.name}</h4>
                    <p className="text-xs text-charcoal/75">
                      {proj.project_type} · {proj.location}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={
                        proj.status === 'At Risk'
                          ? 'warning'
                          : proj.status === 'Completed'
                            ? 'success'
                            : 'info'
                      }
                      showDot
                    >
                      {proj.status}
                    </Badge>
                    {proj.is_demo_reference && (
                      <span className="font-mono text-[10px] text-charcoal/65">SEED REF</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-neutral pt-2 text-xs">
                  <span className="bx-tabular text-charcoal">
                    Planned: <strong>{proj.planned_progress_pct}%</strong> · Actual:{' '}
                    <strong>{proj.actual_progress_pct}%</strong>
                  </span>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
                          onClick={() => void handleQuickProgressBump(proj)}
                        >
                          +5% Progress
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => void handleDeleteProject(proj.project_code)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
