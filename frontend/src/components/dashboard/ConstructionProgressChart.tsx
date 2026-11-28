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
import type { DemoProjectRecord } from '../../data/demoOverviewData'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../ui'

export interface ConstructionProgressChartProps {
  projects: DemoProjectRecord[]
}

export function ConstructionProgressChart({ projects }: ConstructionProgressChartProps) {
  const chartData = projects.map((project) => ({
    name: project.name.replace(' (Demo)', ''),
    Planned: project.plannedProgressPct,
    Actual: project.actualProgressPct,
  }))

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Construction Progress Overview</CardTitle>
          <CardDescription>
            Planned vs. actual completion percentage across filtered portfolio items.
          </CardDescription>
        </div>
        <Badge variant="warning" showDot>
          DEMO DATA
        </Badge>
      </CardHeader>

      <CardContent className="flex-1">
        {chartData.length === 0 ? (
          <EmptyState
            title="No projects match current filters"
            description="Reset project or status filters to view planned vs. actual progress bars."
          />
        ) : (
          <div className="h-[245px] w-full min-w-0 sm:h-[290px]" aria-label="Planned versus actual construction progress bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 10, left: -16, bottom: 16 }}
                barGap={6}
              >
                <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  minTickGap={16}
                  tickFormatter={(val) => String(val).slice(0, 12)}
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
                  formatter={(value) => [`${value ?? 0}%`, undefined]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DED7CB',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#292D32',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar
                  dataKey="Planned"
                  name="Planned Progress (%)"
                  fill="#183153"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="Actual"
                  name="Actual Progress (%)"
                  fill="#F0785F"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
