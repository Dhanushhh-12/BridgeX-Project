import { CalendarOff, Info } from 'lucide-react'
import { DEMO_PROJECTS } from '../../data/demoOverviewData'
import type { DemoTaskProgressRecord } from '../../data/demoProgressData'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../ui'

export interface TaskTimelineCardProps {
  selectedProjectId: string
  tasks: DemoTaskProgressRecord[]
}

export function TaskTimelineCard({ selectedProjectId, tasks }: TaskTimelineCardProps) {
  const selectedProject =
    selectedProjectId !== 'all' ? DEMO_PROJECTS.find((p) => p.id === selectedProjectId) : null

  const maxDuration = Math.max(
    1,
    ...tasks.map((t) => Math.max(t.plannedDurationDays, t.actualDurationDays ?? 0)),
  )

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Duration &amp; Schedule Variance View</CardTitle>
          <CardDescription>
            Compares planned duration (days) vs. recorded duration (days) where available.
          </CardDescription>
        </div>
        <Badge variant="warning" showDot>
          DEMO DATA (Days Only)
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {selectedProject && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border-neutral bg-ivory/70 px-4 py-3 text-xs">
            <div>
              <span className="bx-label">Selected Project Window (Demo)</span>
              <p className="mt-0.5 font-semibold text-editorial-blue">{selectedProject.name}</p>
            </div>
            <div className="font-mono text-editorial-blue">
              Planned Window: {selectedProject.startDate} &rarr; {selectedProject.expectedCompletion}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-sm border border-border-neutral bg-sand/55 p-3 text-xs text-charcoal">
          <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p>
            <strong className="text-editorial-blue">Task Calendar Dates Not Stored:</strong>{' '}
            <code>construction_tasks.csv</code> contains task durations in days (
            <code>planned_duration</code>, <code>actual_duration</code>) without start or finish
            calendar timestamps. Bars below visualize day counts and calculable duration variance
            honestly without inventing task dates.
          </p>
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks to compare"
            description="Adjust filters to inspect task planned vs. actual duration variance."
          />
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 6).map((task) => {
              const plannedPct = Math.round((task.plannedDurationDays / maxDuration) * 100)
              const actualPct =
                task.actualDurationDays !== null
                  ? Math.round((task.actualDurationDays / maxDuration) * 100)
                  : null
              const variance =
                task.actualDurationDays !== null
                  ? Number((task.actualDurationDays - task.plannedDurationDays).toFixed(1))
                  : null

              return (
                <div
                  key={task.id}
                  className="rounded-sm border border-border-neutral bg-ivory/40 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-editorial-blue">
                        {task.taskCode}
                      </span>{' '}
                      <span className="font-medium text-charcoal">{task.taskName}</span>
                    </div>
                    <div className="flex items-center gap-2 bx-tabular">
                      <span className="text-charcoal/80">
                        Plan: <strong>{task.plannedDurationDays}d</strong>
                      </span>
                      <span className="text-charcoal/80">
                        Actual:{' '}
                        <strong>
                          {task.actualDurationDays !== null ? `${task.actualDurationDays}d` : 'In progress'}
                        </strong>
                      </span>
                      {variance !== null ? (
                        <Badge variant={variance > 0 ? 'critical' : 'success'}>
                          {variance > 0 ? `+${variance}d behind` : `${variance}d variance`}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Pending finish</Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-medium uppercase text-editorial-blue">
                        Planned
                      </span>
                      <div className="h-2 flex-1 rounded-xs bg-sand/70">
                        <div
                          className="h-full rounded-xs bg-editorial-blue"
                          style={{ width: `${plannedPct}%` }}
                        />
                      </div>
                    </div>
                    {actualPct !== null && (
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[10px] font-medium uppercase text-coral">
                          Actual
                        </span>
                        <div className="h-2 flex-1 rounded-xs bg-sand/70">
                          <div
                            className={`h-full rounded-xs ${variance && variance > 0 ? 'bg-coral' : 'bg-sage'}`}
                            style={{ width: `${actualPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {tasks.length > 6 && (
              <p className="inline-flex items-center gap-1.5 text-[11px] text-charcoal/75">
                <Info className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
                Showing top 6 filtered tasks in duration bars. Use the full table below to page
                through all {tasks.length} tasks.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
