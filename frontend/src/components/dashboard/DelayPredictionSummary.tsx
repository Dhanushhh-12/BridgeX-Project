import { AlertTriangle, Clock, Info, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PredictionRequestPayload, PredictionResponse } from '../../types/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingIndicator,
} from '../ui'

export interface BenchmarkPredictionItem {
  projectId: string
  projectName: string
  input: PredictionRequestPayload
  result: PredictionResponse
}

export interface DelayPredictionSummaryProps {
  status: 'loading' | 'ready' | 'error' | 'empty'
  errorMessage: string | null
  items: BenchmarkPredictionItem[]
  onRetry: () => void
}

export function DelayPredictionSummary({
  status,
  errorMessage,
  items,
  onRetry,
}: DelayPredictionSummaryProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>ML Delay Prediction Overview</CardTitle>
          <CardDescription>
            Live XGBoost regression estimates (<code>POST /predict</code>) for benchmark tasks.
          </CardDescription>
        </div>
        <Badge variant={status === 'ready' ? 'info' : 'neutral'} showDot>
          {status === 'ready' ? 'LIVE ML API' : 'ML Status'}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {status === 'loading' && <LoadingIndicator label="Running live XGBoost predictions..." />}

        {status === 'error' && (
          <ErrorState
            compact
            title="ML prediction service unavailable"
            message={errorMessage ?? 'Unable to query POST /predict on the FastAPI backend.'}
            action={
              <Button
                size="sm"
                variant="outline"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={onRetry}
              >
                Retry
              </Button>
            }
          />
        )}

        {status === 'empty' && (
          <EmptyState
            title="No benchmark tasks selected"
            description="Select at least one project or reset filters to run live ML duration estimates."
          />
        )}

        {status === 'ready' && items.length > 0 && (
          <div className="space-y-3">
            {items.map((entry) => {
              const planned = entry.input.planned_duration
              const predicted = entry.result.predicted_value
              const diffDays = Number((predicted - planned).toFixed(1))

              return (
                <div
                  key={entry.projectId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border-neutral bg-ivory/60 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-editorial-blue">
                      {entry.projectName}
                    </p>
                    <p className="text-xs text-charcoal/80">
                      {entry.input.task_type} · {entry.input.contractor} · Planned{' '}
                      <span className="font-mono">{planned}d</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 bx-tabular">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-editorial-blue">
                        {predicted.toFixed(1)} {entry.result.units}
                      </p>
                      <p className="text-[11px] text-charcoal/75">Predicted actual_duration</p>
                    </div>
                    <Badge variant={diffDays > 0 ? 'warning' : 'success'}>
                      {diffDays > 0 ? `+${diffDays}d variance` : `${diffDays}d variance`}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Explicit Model Scope & Unavailable Metrics Notice */}
        <div className="space-y-2 rounded-sm border border-border-neutral bg-sand/55 p-3.5 text-xs text-charcoal">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
            <p>
              <strong className="text-editorial-blue">Predicted Duration vs. Project Delay:</strong>{' '}
              The saved XGBoost model (<code>models/delay_predictor.pkl</code>) predicts total{' '}
              <code>actual_duration</code> in days from 7 task features—not a project-level delay
              probability. Delay variance shown above compares predicted days against the task&apos;s
              planned duration.
            </p>
          </div>
          <div className="flex items-start gap-2 border-t border-border-neutral pt-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" aria-hidden="true" />
            <p>
              <strong className="text-editorial-blue">Unavailable Metrics:</strong> Delay
              Probability (%) and Live Portfolio Historical Accuracy are unavailable because the
              trained model is a task-level regressor and DB persistence is not yet connected.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-charcoal/75">
          <Clock className="h-3.5 w-3.5 text-sage" aria-hidden="true" />
          Target: <code>actual_duration</code> (days)
        </span>
        <Link to="/predict">
          <Button size="sm" variant="outline">
            Delay Predictor Module
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
