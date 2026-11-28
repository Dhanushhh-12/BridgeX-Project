import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DemoProjectRecord } from '../../data/demoOverviewData'
import type { DemoTaskProgressRecord } from '../../data/demoProgressData'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../ui'

export interface ProjectPortfolioChartsProps {
  projects: DemoProjectRecord[]
  tasks: DemoTaskProgressRecord[]
  reduceMotion: boolean
}

export function ProjectPortfolioCharts({
  projects,
  tasks,
  reduceMotion,
}: ProjectPortfolioChartsProps) {
  const projectDonutData = [
    {
      name: 'Active',
      value: projects.filter((p) => p.status === 'Active').length,
      color: '#183153',
    },
    {
      name: 'Completed',
      value: projects.filter((p) => p.status === 'Completed').length,
      color: '#8B9B91',
    },
    {
      name: 'Attention Required',
      value: projects.filter((p) => p.status === 'At Risk').length,
      color: '#F0785F',
    },
  ].filter((d) => d.value > 0)

  const taskDonutData = [
    {
      name: 'Completed',
      value: tasks.filter((t) => t.status === 'Completed').length,
      color: '#8B9B91',
    },
    {
      name: 'In Progress',
      value: tasks.filter((t) => t.status === 'In Progress').length,
      color: '#183153',
    },
    {
      name: 'Pending',
      value: tasks.filter((t) => t.status === 'Pending').length,
      color: '#E8DFD0',
    },
    {
      name: 'Delayed (Plan Exceeded)',
      value: tasks.filter((t) => t.status === 'Delayed').length,
      color: '#F0785F',
    },
  ].filter((d) => d.value > 0)

  const projectComparisonData = projects.map((p) => ({
    code: p.projectCode.replace('BX-DEMO-', '#'),
    name: p.name.replace(' (Demo)', ''),
    Planned: p.plannedProgressPct,
    Actual: p.actualProgressPct,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Donut 1: Project Distribution */}
      <Card className="lg:col-span-4 flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Project Status Breakdown</CardTitle>
            <CardDescription>Active vs. Completed vs. Attention Required.</CardDescription>
          </div>
          <Badge variant="warning">DEMO DATA</Badge>
        </CardHeader>
        <CardContent className="flex-1">
          {projectDonutData.length === 0 ? (
            <EmptyState title="No projects match filters" description="Reset filters to display distribution." />
          ) : (
            <div className="h-[240px] w-full min-w-0 sm:h-[250px]" aria-label="Project status donut chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={2}
                    isAnimationActive={!reduceMotion}
                  >
                    {projectDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#FFFFFF" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val ?? 0} project(s)`, undefined]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DED7CB',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Donut 2: Task Status Distribution */}
      <Card className="lg:col-span-4 flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Construction Task Distribution</CardTitle>
            <CardDescription>Completed, In Progress, Pending &amp; Delayed tasks.</CardDescription>
          </div>
          <Badge variant="warning">DEMO DATA</Badge>
        </CardHeader>
        <CardContent className="flex-1">
          {taskDonutData.length === 0 ? (
            <EmptyState title="No tasks match filters" description="Reset filters to display task status split." />
          ) : (
            <div className="h-[240px] w-full" aria-label="Construction task status donut chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={!reduceMotion}
                  >
                    {taskDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#DED7CB" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val ?? 0} task(s)`, undefined]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DED7CB',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar Chart: Project-Wise Performance */}
      <Card className="lg:col-span-4 flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Project Progress Comparison</CardTitle>
            <CardDescription>Planned vs. Actual completion (%) by project.</CardDescription>
          </div>
          <Badge variant="warning">DEMO DATA</Badge>
        </CardHeader>
        <CardContent className="flex-1">
          {projectComparisonData.length === 0 ? (
            <EmptyState title="No projects selected" description="Adjust filters to compare projects." />
          ) : (
            <div className="h-[240px] w-full" aria-label="Project progress comparison bar chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={projectComparisonData}
                  margin={{ top: 8, right: 8, left: -16, bottom: 4 }}
                  barGap={4}
                >
                  <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="code" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={{ stroke: '#DED7CB' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    formatter={(val) => [`${val ?? 0}%`, undefined]}
                    labelFormatter={(label, payload) => {
                      const rowName = payload?.[0]?.payload?.name as string | undefined
                      return rowName ? `${label} — ${rowName}` : String(label)
                    }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DED7CB',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="Planned"
                    name="Planned (%)"
                    fill="#183153"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={!reduceMotion}
                  />
                  <Bar
                    dataKey="Actual"
                    name="Actual (%)"
                    fill="#F0785F"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={!reduceMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
