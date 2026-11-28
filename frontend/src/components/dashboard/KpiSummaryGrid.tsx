import { useRef } from 'react'
import { Activity, AlertCircle, Building2, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useAnimatedNumber, useGsapStagger } from '../../lib/motion'
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
  const gridRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()

  useGsapStagger(
    gridRef,
    '.bx-kpi-card',
    `${totalProjects}-${activeProjects}-${atRiskProjects}-${completedProjects}`,
    reducedMotion,
  )

  const animTotal = useAnimatedNumber(totalProjects, 0, reducedMotion)
  const animActive = useAnimatedNumber(activeProjects, 0, reducedMotion)
  const animAvgProgress = useAnimatedNumber(averageProgressPct, 1, reducedMotion)
  const animAtRisk = useAnimatedNumber(atRiskProjects, 0, reducedMotion)
  const animCompleted = useAnimatedNumber(completedProjects, 0, reducedMotion)
  const animMlAvg = useAnimatedNumber(
    mlStatus === 'ready' ? averagePredictedDurationDays : null,
    1,
    reducedMotion,
  )

  const cards = [
    {
      id: 'total',
      label: 'Total Projects',
      value: animTotal,
      subtext: 'Filtered portfolio records',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: Building2,
      accent: 'text-editorial-blue',
    },
    {
      id: 'active',
      label: 'Active Projects',
      value: animActive,
      subtext: 'Ongoing execution phase',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: Activity,
      accent: 'text-editorial-blue',
    },
    {
      id: 'avg-progress',
      label: 'Avg. Construction Progress',
      value: averageProgressPct !== null ? `${animAvgProgress}%` : '—',
      subtext: 'Actual across filtered sites',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: TrendingUp,
      accent: 'text-editorial-blue',
    },
    {
      id: 'risk',
      label: 'Projects at Delay Risk',
      value: animAtRisk,
      subtext: 'Flagged in demo status',
      sourceBadge: <Badge variant="warning">DEMO DATA</Badge>,
      icon: AlertCircle,
      accent: atRiskProjects > 0 ? 'text-coral' : 'text-editorial-blue',
    },
    {
      id: 'completed',
      label: 'Completed Projects',
      value: animCompleted,
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
            ? `${animMlAvg} days`
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
    <section
      ref={gridRef}
      aria-label="Executive KPI Summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((item) => {
        const Icon = item.icon
        return (
          <Card
            key={item.id}
            padding="sm"
            className="bx-kpi-card flex flex-col justify-between transition-[transform,border-color] duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="bx-label leading-snug">{item.label}</p>
              <Icon className={`h-4 w-4 shrink-0 ${item.accent}`} aria-hidden="true" />
            </div>

            <div className="mt-3">
              <p className="text-2xl font-semibold tracking-tight text-editorial-blue bx-tabular">
                {item.value}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-neutral pt-2">
                <span className="truncate text-[11px] text-charcoal/70">{item.subtext}</span>
                {item.sourceBadge}
              </div>
            </div>
          </Card>
        )
      })}
    </section>
  )
}
