import { Activity, AlertCircle, Building2, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { Badge, Card } from '../ui'

export interface KpiSummaryGridProps {
  totalProjects: number
  activeProjects: number
  averageProgressPct: number | null
  atRiskProjects: number
  completedProjects: number
  averagePredictedDurationDays: number | null
  mlStatus: 'loading' | 'ready' | 'error' | 'empty'
}

export function KpiSummaryGrid({
  totalProjects,
  activeProjects,
  averageProgressPct,
  atRiskProjects,
  completedProjects,
  averagePredictedDurationDays,
  mlStatus,
}: KpiSummaryGridProps) {
  const cards = [
    {
      id: 'total',
      label: 'Total Projects',
      value: String(totalProjects),
      subtext: 'Filtered portfolio records',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: Building2,
      accent: 'text-editorial-blue',
    },
    {
      id: 'active',
      label: 'Active Projects',
      value: String(activeProjects),
      subtext: 'Ongoing execution phase',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: Activity,
      accent: 'text-editorial-blue',
    },
    {
      id: 'avg-progress',
      label: 'Avg. Construction Progress',
      value: averageProgressPct !== null ? `${averageProgressPct.toFixed(1)}%` : '—',
      subtext: 'Actual across filtered sites',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: TrendingUp,
      accent: 'text-editorial-blue',
    },
    {
      id: 'risk',
      label: 'Projects at Delay Risk',
      value: String(atRiskProjects),
      subtext: 'Flagged in demo status',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: AlertCircle,
      accent: atRiskProjects > 0 ? 'text-coral' : 'text-editorial-blue',
    },
    {
      id: 'completed',
      label: 'Completed Projects',
      value: String(completedProjects),
      subtext: 'Final inspection cleared',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: CheckCircle2,
      accent: 'text-sage',
    },
    {
      id: 'ml-avg',
      label: 'Avg. Predicted Duration',
      value:
        mlStatus === 'loading'
          ? 'Loading...'
          : mlStatus === 'ready' && averagePredictedDurationDays !== null
            ? `${averagePredictedDurationDays.toFixed(1)} days`
            : 'Unavailable',
      subtext:
        mlStatus === 'ready'
          ? 'Live XGBoost task benchmarks'
          : mlStatus === 'error'
            ? 'POST /predict unreachable'
            : 'No benchmark task selected',
      sourceBadge: (
        <Badge variant={mlStatus === 'ready' ? 'info' : 'neutral'}>
          {mlStatus === 'ready' ? 'LIVE ML API' : 'ML API'}
        </Badge>
      ),
      icon: Clock,
      accent: 'text-coral',
    },
  ]

  return (
    <section aria-label="Executive KPI Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.id} padding="sm" className="flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-editorial-blue/90">
                {item.label}
              </span>
              <Icon className={`h-4 w-4 shrink-0 ${item.accent}`} aria-hidden="true" />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-semibold tracking-tight text-editorial-blue bx-tabular">
                {item.value}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-charcoal/75">{item.subtext}</span>
                {item.sourceBadge}
              </div>
            </div>
          </Card>
        )
      })}
    </section>
  )
}
