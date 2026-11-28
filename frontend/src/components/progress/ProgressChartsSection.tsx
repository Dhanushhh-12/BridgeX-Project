import { History } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CSV_STAGE_BENCHMARKS, type DemoTaskProgressRecord } from '../../data/demoProgressData'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../ui'

export interface ProgressChartsSectionProps {
  tasks: DemoTaskProgressRecord[]
}

export function ProgressChartsSection({ tasks }: ProgressChartsSectionProps) {
  const taskComparisonData = tasks.map((task) => ({
    name: task.taskCode,
    fullName: task.taskName.replace(' (Demo)', ''),
    Planned: task.plannedProgressPct,
    Actual: task.currentProgressPct,
  }))

  const stageChartData = CSV_STAGE_BENCHMARKS.map((item) => {
    const matched = tasks.filter((t) => t.category === item.stage)
    const avgDemoActual =
      matched.length > 0
        ? Math.round(matched.reduce((s, t) => s + t.currentProgressPct, 0) / matched.length)
        : 0
    const avgDemoPlanned =
      matched.length > 0
        ? Math.round(matched.reduce((s, t) => s + t.plannedProgressPct, 0) / matched.length)
        : 0
    return {
      stage: item.stage.replace('Foundation ', 'Fdn. ').replace('Structural ', 'Struct. '),
      Planned: avgDemoPlanned,
      Actual: avgDemoActual,
      hasData: matched.length > 0,
    }
  }).filter((row) => row.hasData)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Chart 1: Planned vs Actual Progress by Task */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Planned vs. Actual Progress (By Task)</CardTitle>
              <CardDescription>
                Compares demo target completion % against current reported progress %.
              </CardDescription>
            </div>
            <Badge variant="warning" showDot>
              DEMO DATA
            </Badge>
          </CardHeader>
          <CardContent className="flex-1">
            {taskComparisonData.length === 0 ? (
              <EmptyState
                title="No tasks match active filters"
                description="Reset project, status, or category filters to render task progress bars."
              />
            ) : (
              <div className="h-[240px] w-full min-w-0 sm:h-[270px]" aria-label="Planned versus actual task progress chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={taskComparisonData}
                    margin={{ top: 10, right: 10, left: -18, bottom: 8 }}
                    barGap={4}
                  >
                    <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      minTickGap={14}
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={{ stroke: '#DED7CB' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val, name) => [`${val ?? 0}%`, name]}
                      labelFormatter={(label) => {
                        const found = taskComparisonData.find((d) => d.name === label)
                        return found ? `${found.name} — ${found.fullName}` : String(label)
                      }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#DED7CB',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Planned" name="Planned (%)" fill="#183153" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Actual" name="Actual (%)" fill="#F0785F" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Progress by Construction Stage */}
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Progress by Construction Category</CardTitle>
              <CardDescription>
                Average planned vs. actual completion % aggregated by construction stage.
              </CardDescription>
            </div>
            <Badge variant="warning" showDot>
              DEMO DATA
            </Badge>
          </CardHeader>
          <CardContent className="flex-1">
            {stageChartData.length === 0 ? (
              <EmptyState
                title="No stages match active filters"
                description="Select All Categories or another project to view stage comparisons."
              />
            ) : (
              <div className="h-[270px] w-full" aria-label="Construction stage progress chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stageChartData}
                    margin={{ top: 10, right: 12, left: -16, bottom: 8 }}
                    barGap={4}
                  >
                    <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="stage"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={{ stroke: '#DED7CB' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val, name) => [`${val ?? 0}%`, name]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#DED7CB',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Planned" name="Stage Planned (%)" fill="#183153" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Actual" name="Stage Actual (%)" fill="#8B9B91" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart 3: Honest Unavailable State for Progress Over Time */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Progress Over Time (Historical Trend)</CardTitle>
            <CardDescription>
              Time-series trajectory of physical construction completion across reporting dates.
            </CardDescription>
          </div>
          <Badge variant="neutral">No Historical Series</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <EmptyState
            icon={<History className="h-5 w-5 text-sage" />}
            title="Historical Time-Series Data Unavailable"
            description="Neither data/construction_tasks.csv nor the FastAPI backend stores dated historical progress snapshots yet. Historical progress charts are intentionally withheld so time-series curves are never fabricated."
          />
        </CardContent>
      </Card>
    </div>
  )
}
