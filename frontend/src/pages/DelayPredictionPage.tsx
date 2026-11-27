import { useEffect, useState } from 'react'
import { AlertTriangle, Info, RefreshCw, Trash2 } from 'lucide-react'
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
import { PageHeader } from '../components/layout'
import {
  ModelPerformanceAndShap,
  PredictionForm,
  PredictionResultCard,
} from '../components/predict'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  type TableColumn,
} from '../components/ui'
import { MODEL_EVALUATION } from '../data/mlModelMetadata'
import { ApiClientError, getHealth, postPredict } from '../services/apiClient'
import type { HealthResponse, PredictionRequestPayload, PredictionResponse } from '../types/api'

interface SessionPredictionRun {
  id: string
  runLabel: string
  timestamp: string
  input: PredictionRequestPayload
  result: PredictionResponse
  varianceDays: number
}

export function DelayPredictionPage() {
  const [healthNonce, setHealthNonce] = useState(0)
  const [apiHealth, setApiHealth] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
  }>({ status: 'loading', data: null })

  const [predictionState, setPredictionState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    input: PredictionRequestPayload | null
    result: PredictionResponse | null
    errorMessage: string | null
    errorStatusCode: number | null
  }>({
    status: 'idle',
    input: null,
    result: null,
    errorMessage: null,
    errorStatusCode: null,
  })

  const [sessionRuns, setSessionRuns] = useState<SessionPredictionRun[]>([])

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setApiHealth({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setApiHealth({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [healthNonce])

  async function runPrediction(payload: PredictionRequestPayload) {
    setPredictionState({
      status: 'loading',
      input: payload,
      result: null,
      errorMessage: null,
      errorStatusCode: null,
    })

    try {
      const response = await postPredict(payload)
      const varianceDays = Number((response.predicted_value - payload.planned_duration).toFixed(1))

      setPredictionState({
        status: 'ready',
        input: payload,
        result: response,
        errorMessage: null,
        errorStatusCode: null,
      })

      setSessionRuns((prev) => {
        const nextIndex = prev.length + 1
        const entry: SessionPredictionRun = {
          id: `run-${Date.now()}-${nextIndex}`,
          runLabel: `Run #${nextIndex}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          input: payload,
          result: response,
          varianceDays,
        }
        return [entry, ...prev].slice(0, 12)
      })
    } catch (err) {
      const statusCode = err instanceof ApiClientError ? err.status : null
      const message =
        err instanceof Error ? err.message : 'Unexpected failure contacting POST /predict.'
      setPredictionState({
        status: 'error',
        input: payload,
        result: null,
        errorMessage: message,
        errorStatusCode: statusCode,
      })
    }
  }

  function handleRetryLast() {
    if (predictionState.input) {
      void runPrediction(predictionState.input)
    }
  }

  function handleCheckBackend() {
    setApiHealth((prev) => ({ ...prev, status: 'loading' }))
    setHealthNonce((n) => n + 1)
  }

  const comparisonChartData = [...sessionRuns]
    .reverse()
    .map((run) => ({
      name: `${run.runLabel} (${run.input.task_type.split(' ')[0]})`,
      Planned: run.input.planned_duration,
      Predicted: run.result.predicted_value,
    }))

  const historyColumns: TableColumn<SessionPredictionRun>[] = [
    {
      key: 'runLabel',
      header: 'Run',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">
          {row.runLabel}
        </span>
      ),
    },
    {
      key: 'task',
      header: 'Task & Contractor',
      render: (row) => (
        <div className="text-xs">
          <p className="font-semibold text-editorial-blue">{row.input.task_type}</p>
          <p className="text-charcoal/75">{row.input.contractor}</p>
        </div>
      ),
    },
    {
      key: 'planned',
      header: 'Planned',
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.input.planned_duration}d</span>,
    },
    {
      key: 'predicted',
      header: 'Predicted Actual',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">
          {row.result.predicted_value.toFixed(1)}d
        </span>
      ),
    },
    {
      key: 'variance',
      header: 'Overrun Indicator',
      render: (row) => (
        <Badge variant={row.varianceDays > 0 ? 'warning' : 'success'}>
          {row.varianceDays > 0 ? `+${row.varianceDays}d over plan` : `${row.varianceDays}d`}
        </Badge>
      ),
    },
    {
      key: 'timestamp',
      header: 'Session Time',
      render: (row) => <span className="font-mono text-xs text-charcoal/75">{row.timestamp}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence Engines"
        title="ML Delay Prediction & Analytics"
        description="Estimate construction task actual_duration (in days) using the trained XGBoost regressor via POST /predict."
        breadcrumbs={[{ label: 'Delay Prediction' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {apiHealth.status === 'ready' && apiHealth.data ? (
              <Badge variant="success" showDot>
                API {apiHealth.data.version}: {apiHealth.data.status}
              </Badge>
            ) : apiHealth.status === 'error' ? (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            ) : (
              <Badge variant="neutral">Checking API...</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              isLoading={apiHealth.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={handleCheckBackend}
            >
              Check Backend
            </Button>
          </div>
        }
      />

      {/* Model Target Clarification */}
      <Card variant="sand" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-editorial-blue">Model Scope Clarification:</strong>{' '}
            <code>{MODEL_EVALUATION.modelPath}</code> predicts{' '}
            <code>{MODEL_EVALUATION.targetVariable}</code> in <strong>days</strong> across 7 encoded
            features. It does not output delay probability percentages or project completion calendar
            dates. Positive differences above planned duration indicate potential schedule overrun,
            not verified delays.
          </p>
        </div>
      </Card>

      {/* Main Form + Live Prediction Result */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PredictionForm
            isSubmitting={predictionState.status === 'loading'}
            onSubmitPayload={(payload) => void runPrediction(payload)}
          />
        </div>
        <div className="xl:col-span-5">
          <PredictionResultCard
            status={predictionState.status}
            input={predictionState.input}
            result={predictionState.result}
            errorMessage={predictionState.errorMessage}
            errorStatusCode={predictionState.errorStatusCode}
            onRetry={handleRetryLast}
          />
        </div>
      </div>

      {/* Live Session Task-Level Comparison (In-Browser Only) */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Task-Level Prediction Comparison (Current Session)</CardTitle>
            <CardDescription>
              Compares live <code>POST /predict</code> outputs from this browser session against
              their planned durations. FastAPI does not persist prediction history yet.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">Session-Only (Not Saved to DB)</Badge>
            {sessionRuns.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setSessionRuns([])}
              >
                Clear Session
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {sessionRuns.length === 0 ? (
            <EmptyState
              title="No Live Predictions in This Session Yet"
              description="Submit at least one prediction above to compare Planned vs. Predicted Actual Duration across tasks."
            />
          ) : (
            <>
              <div
                className="h-[240px] w-full"
                aria-label="Planned versus predicted task duration comparison chart"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={comparisonChartData}
                    margin={{ top: 10, right: 16, left: -10, bottom: 8 }}
                    barGap={6}
                  >
                    <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={{ stroke: '#DED7CB' }}
                      tickLine={false}
                    />
                    <YAxis
                      unit="d"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v) => [`${v ?? 0} days`, undefined]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#DED7CB',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Planned" name="Planned Duration (days)" fill="#183153" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Predicted" name="Predicted Actual (days)" fill="#F0785F" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <Table
                caption="Current browser session live prediction comparisons"
                columns={historyColumns}
                data={sessionRuns}
                rowKey={(row) => row.id}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Metrics & Global SHAP Explainability */}
      <ModelPerformanceAndShap />

      {/* Missing Backend Endpoints Report */}
      <Card variant="ivory" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <p>
            <strong className="text-editorial-blue">Optional Future Backend Extensions:</strong>{' '}
            Persisting prediction runs across reloads requires a database table +{' '}
            <code>GET /api/v1/predictions</code>, and returning live per-input SHAP waterfall drivers
            requires an endpoint such as <code>POST /api/v1/predict/explain</code>.
          </p>
        </div>
      </Card>
    </div>
  )
}
