import { Info } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CSV_CONTRACTOR_ANALYTICS,
  HELD_OUT_ML_SAMPLES,
} from '../../data/analyticsDataset'
import { CSV_STAGE_BENCHMARKS } from '../../data/demoProgressData'
import { MODEL_EVALUATION } from '../../data/mlModelMetadata'
import type { PredictionRequestPayload, PredictionResponse } from '../../types/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'

export interface MlAndConstructionChartsProps {
  liveBenchmarkInput: PredictionRequestPayload | null
  liveBenchmarkResult: PredictionResponse | null
  liveBenchmarkStatus: 'loading' | 'ready' | 'error' | 'empty'
  reduceMotion: boolean
}

export function MlAndConstructionCharts({
  liveBenchmarkInput,
  liveBenchmarkResult,
  liveBenchmarkStatus,
  reduceMotion,
}: MlAndConstructionChartsProps) {
  const stageAreaData = CSV_STAGE_BENCHMARKS.map((s) => ({
    stage: s.stage.replace('Foundation ', 'Fdn. ').replace('Structural ', 'Struct. '),
    Planned: s.csvMeanPlannedDays,
    Actual: s.csvMeanActualDays,
  }))

  const contractorChartData = CSV_CONTRACTOR_ANALYTICS.map((c) => ({
    name: c.contractor.replace(' Engineering', '').replace(' Civil Works', '').replace(' Infrastructure', ''),
    fullName: c.contractor,
    taskCount: c.taskCount,
    meanOverrun: c.meanOverrunDays,
    meanPlanned: c.meanPlannedDays,
    meanActual: c.meanActualDays,
  }))

  return (
    <div className="space-y-6">
      {/* ML Analytics Row */}
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7 flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>ML Predicted vs. Actual Task Duration (Held-Out Test Set)</CardTitle>
              <CardDescription>
                Real outputs from <code>models/delay_predictor.pkl</code> across 10 held-out test
                records (<code>train.py</code> 20% split, seed 42).
              </CardDescription>
            </div>
            <Badge variant="info" showDot>
              VERIFIED ML MODEL
            </Badge>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <div className="h-[240px] w-full min-w-0 sm:h-[265px]" aria-label="ML predicted versus recorded actual duration line chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={HELD_OUT_ML_SAMPLES}
                  margin={{ top: 10, right: 10, left: -16, bottom: 4 }}
                >
                  <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="taskId"
                    minTickGap={14}
                    tick={{ fill: '#292D32', fontSize: 11 }}
                    axisLine={{ stroke: '#DED7CB' }}
                    tickFormatter={(id) => `#${id}`}
                  />
                  <YAxis unit="d" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    formatter={(val) => [`${Number(val ?? 0).toFixed(1)} days`, undefined]}
                    labelFormatter={(label, payload) => {
                      const taskType = payload?.[0]?.payload?.taskType as string | undefined
                      return `Test Task #${label}${taskType ? ` (${taskType})` : ''}`
                    }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DED7CB',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="recordedActualDays"
                    name="Recorded Actual (days)"
                    stroke="#183153"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#183153' }}
                    isAnimationActive={!reduceMotion}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedActualDays"
                    name="XGBoost Predicted (days)"
                    stroke="#F0785F"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#F0785F' }}
                    isAnimationActive={!reduceMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-start gap-2 rounded-sm border border-border-neutral bg-sand/55 p-3 text-xs text-charcoal">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <p>
                <strong className="text-editorial-blue">Regression Target Reminder:</strong>{' '}
                <code>XGBRegressor</code> predicts continuous <code>actual_duration</code> in days—not
                delay probability or classification accuracy. Backend prediction history persistence
                is not yet enabled.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ML Evaluation Metrics + Live /predict Probe */}
        <Card className="xl:col-span-5 flex flex-col justify-between">
          <CardHeader>
            <div>
              <CardTitle>Model Evaluation &amp; Live Probe</CardTitle>
              <CardDescription>
                Metrics measured on {MODEL_EVALUATION.testRecords.toLocaleString()} held-out test
                tasks + live <code>POST /predict</code> probe.
              </CardDescription>
            </div>
            <Badge variant={liveBenchmarkStatus === 'ready' ? 'info' : 'neutral'}>
              {liveBenchmarkStatus === 'ready' ? 'LIVE /predict' : 'Metrics'}
            </Badge>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">MAE</p>
                <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                  {MODEL_EVALUATION.metrics.maeDays.toFixed(4)}d
                </p>
                <p className="text-[11px] text-charcoal/70">Mean abs error</p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">RMSE</p>
                <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                  {MODEL_EVALUATION.metrics.rmseDays.toFixed(4)}d
                </p>
                <p className="text-[11px] text-charcoal/70">Root mean sq error</p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">R² Score</p>
                <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                  {MODEL_EVALUATION.metrics.r2Score.toFixed(4)}
                </p>
                <p className="text-[11px] text-charcoal/70">
                  {MODEL_EVALUATION.metrics.r2Percent}% variance
                </p>
              </div>
            </div>

            <div className="rounded-sm border border-border-neutral bg-ivory/50 p-4 space-y-1.5 text-xs">
              <p className="bx-label">Live Filter Benchmark (POST /predict)</p>
              {liveBenchmarkStatus === 'ready' && liveBenchmarkInput && liveBenchmarkResult ? (
                <>
                  <p className="font-semibold text-editorial-blue">
                    {liveBenchmarkInput.task_type} · {liveBenchmarkInput.contractor}
                  </p>
                  <p className="font-mono text-charcoal">
                    Planned: {liveBenchmarkInput.planned_duration}d &rarr; Predicted:{' '}
                    <strong className="text-coral">
                      {liveBenchmarkResult.predicted_value.toFixed(1)} {liveBenchmarkResult.units}
                    </strong>
                  </p>
                </>
              ) : liveBenchmarkStatus === 'loading' ? (
                <p className="text-charcoal/75">Querying POST /predict...</p>
              ) : (
                <p className="text-charcoal/75">
                  Live probe unavailable (backend offline or no project selected).
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Construction Category AreaChart & Contractor Distribution BarChart */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Stage Duration Profile (Planned vs. Actual Days)</CardTitle>
              <CardDescription>
                Mean planned and recorded actual durations across 8 construction stages (6,000
                synthetic CSV rows).
              </CardDescription>
            </div>
            <Badge variant="info">SYNTHETIC CSV</Badge>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[260px] w-full" aria-label="Stage duration area chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stageAreaData}
                  margin={{ top: 10, right: 14, left: -12, bottom: 4 }}
                >
                  <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fill: '#292D32', fontSize: 10 }} axisLine={{ stroke: '#DED7CB' }} />
                  <YAxis unit="d" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    formatter={(v) => [`${Number(v ?? 0).toFixed(2)} days`, undefined]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DED7CB',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="Actual"
                    name="Mean Actual (days)"
                    stroke="#F0785F"
                    fill="#F0785F"
                    fillOpacity={0.22}
                    strokeWidth={2}
                    isAnimationActive={!reduceMotion}
                  />
                  <Area
                    type="monotone"
                    dataKey="Planned"
                    name="Mean Planned (days)"
                    stroke="#183153"
                    fill="#183153"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    isAnimationActive={!reduceMotion}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Contractor-Wise Task Count &amp; Duration Overrun</CardTitle>
              <CardDescription>
                Verified task volume and mean overrun (<code>actual - planned</code> days) across
                the 5 contractors in <code>construction_tasks.csv</code>.
              </CardDescription>
            </div>
            <Badge variant="info">SYNTHETIC CSV</Badge>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[260px] w-full" aria-label="Contractor duration comparison bar chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={contractorChartData}
                  margin={{ top: 10, right: 14, left: -12, bottom: 4 }}
                  barGap={6}
                >
                  <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={{ stroke: '#DED7CB' }} />
                  <YAxis unit="d" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={false} />
                  <Tooltip
                    formatter={(v, name) => [
                      name === 'Tasks Assigned' ? `${v ?? 0} tasks` : `${Number(v ?? 0).toFixed(2)} days`,
                      name,
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string; taskCount?: number } | undefined
                      return row?.fullName ? `${row.fullName} (${row.taskCount} tasks)` : ''
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
                    dataKey="meanPlanned"
                    name="Mean Planned (days)"
                    fill="#183153"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={!reduceMotion}
                  />
                  <Bar
                    dataKey="meanActual"
                    name="Mean Actual (days)"
                    fill="#8B9B91"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={!reduceMotion}
                  />
                  <Bar
                    dataKey="meanOverrun"
                    name="Mean Overrun (days)"
                    fill="#F0785F"
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={!reduceMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
