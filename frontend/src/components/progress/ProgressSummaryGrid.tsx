import { AlertTriangle, CheckCircle2, Clock, Hourglass, Layers, TrendingUp } from 'lucide-react'
import { Badge, Card } from '../ui'

export interface ProgressSummaryGridProps {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  averageProgressPct: number | null
  behindScheduleTasks: number
}

export function ProgressSummaryGrid({
  totalTasks,
  completedTasks,
  inProgressTasks,
  pendingTasks,
  averageProgressPct,
  behindScheduleTasks,
}: ProgressSummaryGridProps) {
  const cards = [
    {
      id: 'total-tasks',
      label: 'Total Tasks',
      value: String(totalTasks),
      note: '6,000 synthetic rows in CSV',
      icon: Layers,
      accent: 'text-editorial-blue',
    },
    {
      id: 'completed-tasks',
      label: 'Completed Tasks',
      value: String(completedTasks),
      note: '100% stage sign-off',
      icon: CheckCircle2,
      accent: 'text-sage',
    },
    {
      id: 'in-progress',
      label: 'In-Progress Tasks',
      value: String(inProgressTasks),
      note: 'Active execution',
      icon: Clock,
      accent: 'text-editorial-blue',
    },
    {
      id: 'pending-tasks',
      label: 'Pending Tasks',
      value: String(pendingTasks),
      note: 'Queued for kickoff',
      icon: Hourglass,
      accent: 'text-charcoal/75',
    },
    {
      id: 'avg-progress',
      label: 'Average Progress',
      value: averageProgressPct !== null ? `${averageProgressPct.toFixed(1)}%` : '—',
      note: 'Mean of task % (not ML days)',
      icon: TrendingUp,
      accent: 'text-editorial-blue',
    },
    {
      id: 'behind-schedule',
      label: 'Behind Schedule',
      value: String(behindScheduleTasks),
      note: 'Actual days > Planned days',
      icon: AlertTriangle,
      accent: behindScheduleTasks > 0 ? 'text-coral' : 'text-editorial-blue',
    },
  ]

  return (
    <section
      aria-label="Construction Progress Summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.id} padding="sm" className="flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <span className="bx-label">{card.label}</span>
              <Icon className={`h-4 w-4 shrink-0 ${card.accent}`} aria-hidden="true" />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-semibold text-editorial-blue bx-tabular">{card.value}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-charcoal/75">{card.note}</span>
                <Badge variant="warning">DEMO DATA</Badge>
              </div>
            </div>
          </Card>
        )
      })}
    </section>
  )
}
