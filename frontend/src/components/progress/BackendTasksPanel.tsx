import { useEffect, useState } from 'react'
import { CheckCircle2, Lock, RefreshCw, TrendingUp } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { getBackendTasks, patchBackendTask } from '../../services/apiClient'
import type { BackendTaskRecord } from '../../types/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingIndicator,
  Table,
  type TableColumn,
} from '../ui'

export function BackendTasksPanel() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<BackendTaskRecord[]>([])
  const [scopedToAssigned, setScopedToAssigned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const canEdit = Boolean(user?.permissions.can_edit_projects)

  useEffect(() => {
    let cancelled = false
    getBackendTasks(50, 0)
      .then((res) => {
        if (!cancelled) {
          setTasks(res.tasks)
          setScopedToAssigned(res.scoped_to_assigned)
          setErrorMsg(null)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to load persisted tasks.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshNonce])

  function reloadTasks() {
    setLoading(true)
    setRefreshNonce((n) => n + 1)
  }

  async function handleBumpProgress(task: BackendTaskRecord) {
    setStatusMsg(null)
    setErrorMsg(null)
    const nextPct = Math.min(100, Number(task.actual_progress_pct) + 10)
    try {
      const res = await patchBackendTask(task.task_code, {
        actual_progress_pct: nextPct,
        status: nextPct >= 100 ? 'Completed' : task.status === 'Pending' ? 'In Progress' : task.status,
      })
      setStatusMsg(
        `Saved ${res.task.task_code} progress (${res.task.actual_progress_pct}%) to SQLite.`,
      )
      reloadTasks()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Task update rejected by backend.')
    }
  }

  const columns: TableColumn<BackendTaskRecord>[] = [
    {
      key: 'task_code',
      header: 'Task ID',
      render: (r) => <span className="font-mono text-xs font-semibold text-editorial-blue">{r.task_code}</span>,
    },
    {
      key: 'project_code',
      header: 'Project / Task',
      render: (r) => (
        <div>
          <p className="font-medium text-editorial-blue">{r.task_name}</p>
          <p className="font-mono text-[11px] text-charcoal/70">
            {r.project_code} · {r.category}
          </p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (r) => (
        <span className="font-mono text-xs text-editorial-blue bx-tabular">
          {r.actual_progress_pct}% / {r.planned_progress_pct}% plan
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge
          variant={
            r.status === 'Delayed'
              ? 'critical'
              : r.status === 'Completed'
                ? 'success'
                : r.status === 'In Progress'
                  ? 'info'
                  : 'neutral'
          }
          showDot
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Controls',
      align: 'right',
      render: (r) =>
        canEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={r.actual_progress_pct >= 100}
            leftIcon={<TrendingUp className="h-3.5 w-3.5" />}
            onClick={() => void handleBumpProgress(r)}
          >
            +10% Progress
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/65">
            <Lock className="h-3 w-3" aria-hidden="true" /> Read-only
          </span>
        ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Persisted SQLite Construction Tasks ({tasks.length})</CardTitle>
          <CardDescription>
            {scopedToAssigned
              ? 'Scoped to your assigned projects via GET /api/v1/tasks.'
              : 'Live task progress rows from GET /api/v1/tasks (PATCH updates persisted in SQLite).'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" showDot>
            LIVE SQLITE DB
          </Badge>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={reloadTasks}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {statusMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-sm border border-sage bg-ivory px-3.5 py-2 text-xs font-medium text-editorial-blue"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && <ErrorState compact title="Task Load Error" message={errorMsg} />}

        {loading ? (
          <LoadingIndicator label="Loading SQLite construction tasks..." />
        ) : (
          <Table
            caption="Persisted construction tasks from SQLite"
            columns={columns}
            data={tasks}
            rowKey={(r) => r.task_code}
            emptyTitle="No persisted tasks assigned"
            emptyDescription="No construction tasks matched your project scope."
          />
        )}
      </CardContent>
    </Card>
  )
}
