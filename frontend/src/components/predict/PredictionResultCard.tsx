import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react'
import type { PredictionRequestPayload, PredictionResponse } from '../../types/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingIndicator,
} from '../ui'

export interface PredictionResultCardProps {
  status: 'idle' | 'loading' | 'ready' | 'error'
  input: PredictionRequestPayload | null
  result: PredictionResponse | null
  errorMessage: string | null
  errorStatusCode: number | null
  onRetry: () => void
}

export function PredictionResultCard({
  status,
  input,
  result,
  errorMessage,
  errorStatusCode,
  onRetry,
}: PredictionResultCardProps) {
  const varianceDays =
    input && result ? Number((result.predicted_value - input.planned_duration).toFixed(1)) : null

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Prediction Output</CardTitle>
          <CardDescription>
            Live XGBoost inference returned by <code>POST /predict</code>.
          </CardDescription>
        </div>
        <Badge variant={status === 'ready' ? 'info' : status === 'error' ? 'critical' : 'neutral'} showDot>
          {status === 'ready' ? 'LIVE ML RESULT' : status === 'error' ? 'API Error' : 'Ready'}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {status === 'idle' && (
          <EmptyState
            icon={<Clock className="h-5 w-5 text-editorial-blue" />}
            title="Submit Task Inputs to Predict"
            description="Fill out the 7 task parameters on the left and click Predict Actual Duration to invoke models/delay_predictor.pkl."
          />
        )}

        {status === 'loading' && (
          <LoadingIndicator label="Running XGBoost regression on FastAPI backend..." />
        )}

        {status === 'error' && (
          <ErrorState
            title={
              errorStatusCode === 503
                ? 'ML Model Unavailable (HTTP 503)'
                : errorStatusCode === 422 || errorStatusCode === 400
                  ? 'Input Validation Rejected'
                  : 'Prediction Request Failed'
            }
            message={
              errorMessage ??
              'Unable to reach POST /predict. Ensure the FastAPI server and models/delay_predictor.pkl are available.'
            }
            action={
              <Button size="sm" variant="primary" onClick={onRetry}>
                Retry Prediction
              </Button>
            }
          />
        )}

        {status === 'ready' && input && result && varianceDays !== null && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-sm border border-editorial-blue bg-editorial-blue px-4 py-3 text-surface">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sand">
                  Predicted Actual Duration
                </p>
                <p className="mt-1 text-2xl font-semibold bx-tabular">
                  {result.predicted_value.toFixed(1)} {result.units}
                </p>
                <p className="mt-0.5 text-[11px] text-sand/85">Target: {result.target}</p>
              </div>

              <div className="rounded-sm border border-border-neutral bg-ivory/70 px-4 py-3">
                <p className="bx-label">Planned Duration</p>
                <p className="mt-1 text-2xl font-semibold text-editorial-blue bx-tabular">
                  {input.planned_duration} days
                </p>
                <p className="mt-0.5 text-[11px] text-charcoal/75">Submitted task baseline</p>
              </div>

              <div className="rounded-sm border border-border-neutral bg-ivory/70 px-4 py-3">
                <p className="bx-label">Duration Difference</p>
                <p
                  className={`mt-1 text-2xl font-semibold bx-tabular ${
                    varianceDays > 0 ? 'text-coral' : 'text-editorial-blue'
                  }`}
                >
                  {varianceDays > 0 ? `+${varianceDays.toFixed(1)}` : varianceDays.toFixed(1)} days
                </p>
                <p className="mt-0.5 text-[11px] text-charcoal/75">
                  {varianceDays > 0
                    ? 'Potential schedule overrun indicator'
                    : varianceDays < 0
                      ? 'Faster than planned duration'
                      : 'Matches planned duration'}
                </p>
              </div>
            </div>

            {varianceDays > 0 ? (
              <div className="flex items-start gap-2.5 rounded-sm border border-coral bg-ivory/80 p-3.5 text-xs text-charcoal">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                <p>
                  <strong className="text-editorial-blue">
                    Potential Schedule Overrun Indicator (+{varianceDays.toFixed(1)} days):
                  </strong>{' '}
                  Based on historical patterns in the training data, this task is estimated to take{' '}
                  <strong>{result.predicted_value.toFixed(1)} total days</strong> compared to your{' '}
                  {input.planned_duration}-day plan. This is an analytical duration estimate—not a
                  verified project delay guarantee or delay probability %.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-sm border border-border-neutral bg-sand/50 p-3.5 text-xs text-charcoal">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                <p>
                  <strong className="text-editorial-blue">Within Planned Duration:</strong> The
                  model estimates this task will complete in{' '}
                  <strong>{result.predicted_value.toFixed(1)} days</strong> ({varianceDays.toFixed(1)}{' '}
                  days relative to the {input.planned_duration}-day plan).
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-charcoal/75">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-editorial-blue" aria-hidden="true" />
              <span>
                Input tested: {input.task_type} · {input.contractor} · Crew {input.crew_size} ·
                Cost ${input.material_cost.toLocaleString()} · Weather {input.weather_risk}/5 ·
                Complexity {input.complexity_level}/10
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
