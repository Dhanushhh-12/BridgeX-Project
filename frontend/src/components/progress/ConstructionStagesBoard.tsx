import { CSV_STAGE_BENCHMARKS, type ConstructionStageName, type DemoTaskProgressRecord } from '../../data/demoProgressData'
import { cn } from '../../lib/cn'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'

export interface ConstructionStagesBoardProps {
  tasks: DemoTaskProgressRecord[]
  selectedStage: string
  onSelectStage: (stage: string) => void
}

export function ConstructionStagesBoard({
  tasks,
  selectedStage,
  onSelectStage,
}: ConstructionStagesBoardProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Construction Stages Pipeline (8 Core Stages)</CardTitle>
          <CardDescription>
            Categories match <code>config.py</code> <code>TASK_TYPES</code>. Click any stage to
            filter the task table; CSV baselines come from <code>construction_tasks.csv</code>.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">SYNTHETIC CSV BASELINES</Badge>
          <Badge variant="warning">DEMO TASK %</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CSV_STAGE_BENCHMARKS.map((benchmark) => {
            const stageTasks = tasks.filter(
              (t) => t.category === (benchmark.stage as ConstructionStageName),
            )
            const avgProgress =
              stageTasks.length > 0
                ? stageTasks.reduce((acc, t) => acc + t.currentProgressPct, 0) / stageTasks.length
                : null
            const isSelected = selectedStage === benchmark.stage
            const hasDelayed = stageTasks.some((t) => t.status === 'Delayed')

            return (
              <button
                key={benchmark.stage}
                type="button"
                onClick={() => onSelectStage(isSelected ? 'all' : benchmark.stage)}
                aria-pressed={isSelected}
                className={cn(
                  'flex flex-col justify-between rounded-sm border p-3.5 text-left transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue',
                  isSelected
                    ? 'border-editorial-blue bg-sand/75'
                    : 'border-border-neutral bg-ivory/50 hover:bg-sand/45',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-charcoal/70">
                      Stage 0{benchmark.sequenceOrder}
                    </span>
                    <p className="text-sm font-semibold text-editorial-blue">{benchmark.stage}</p>
                  </div>
                  <Badge variant={hasDelayed ? 'critical' : stageTasks.length > 0 ? 'info' : 'neutral'}>
                    {stageTasks.length} task{stageTasks.length === 1 ? '' : 's'}
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs bx-tabular">
                    <span className="text-charcoal/80">Demo Stage Avg:</span>
                    <span className="font-semibold text-editorial-blue">
                      {avgProgress !== null ? `${avgProgress.toFixed(0)}%` : 'No matching tasks'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-xs bg-sand" aria-hidden="true">
                    <div
                      className={hasDelayed ? 'h-full bg-coral' : 'h-full bg-editorial-blue'}
                      style={{ width: `${avgProgress ?? 0}%` }}
                    />
                  </div>
                  <p className="font-mono text-[10px] text-charcoal/70">
                    CSV ({benchmark.csvRecordCount} rows): {benchmark.csvMeanPlannedDays}d plan &rarr;{' '}
                    {benchmark.csvMeanActualDays}d actual
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
