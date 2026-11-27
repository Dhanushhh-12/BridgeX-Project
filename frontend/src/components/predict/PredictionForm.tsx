import { useState, type FormEvent } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import {
  CONTRACTORS,
  PREDICTION_PRESETS,
  TASK_TYPES,
} from '../../data/mlModelMetadata'
import type { PredictionRequestPayload } from '../../types/api'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select } from '../ui'
import {
  validatePredictionForm,
  type PredictionFormErrors,
  type PredictionFormState,
} from './validatePredictionForm'

export interface PredictionFormProps {
  isSubmitting: boolean
  onSubmitPayload: (payload: PredictionRequestPayload) => void
}

const DEFAULT_FORM: PredictionFormState = {
  task_type: PREDICTION_PRESETS[0].payload.task_type,
  contractor: PREDICTION_PRESETS[0].payload.contractor,
  planned_duration: String(PREDICTION_PRESETS[0].payload.planned_duration),
  crew_size: String(PREDICTION_PRESETS[0].payload.crew_size),
  material_cost: String(PREDICTION_PRESETS[0].payload.material_cost),
  weather_risk: String(PREDICTION_PRESETS[0].payload.weather_risk),
  complexity_level: String(PREDICTION_PRESETS[0].payload.complexity_level),
}

export function PredictionForm({ isSubmitting, onSubmitPayload }: PredictionFormProps) {
  const [form, setForm] = useState<PredictionFormState>(DEFAULT_FORM)
  const [errors, setErrors] = useState<PredictionFormErrors>({})

  const taskCode = TASK_TYPES.indexOf(form.task_type as (typeof TASK_TYPES)[number])
  const contractorCode = CONTRACTORS.indexOf(form.contractor as (typeof CONTRACTORS)[number])

  function applyPreset(presetPayload: PredictionRequestPayload) {
    setForm({
      task_type: presetPayload.task_type,
      contractor: presetPayload.contractor,
      planned_duration: String(presetPayload.planned_duration),
      crew_size: String(presetPayload.crew_size),
      material_cost: String(presetPayload.material_cost),
      weather_risk: String(presetPayload.weather_risk),
      complexity_level: String(presetPayload.complexity_level),
    })
    setErrors({})
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = validatePredictionForm(form)
    if (!check.valid) {
      setErrors(check.errors)
      return
    }
    setErrors({})
    onSubmitPayload(check.payload)
  }

  const taskOptions = TASK_TYPES.map((t, idx) => ({
    value: t,
    label: `${t} (code ${idx})`,
  }))

  const contractorOptions = CONTRACTORS.map((c, idx) => ({
    value: c,
    label: `${c} (code ${idx})`,
  }))

  const weatherOptions = [
    { value: '1', label: '1 — Clear / Low Risk' },
    { value: '2', label: '2 — Mild Weather Risk' },
    { value: '3', label: '3 — Moderate Weather Risk' },
    { value: '4', label: '4 — Elevated Rain/Wind Risk' },
    { value: '5', label: '5 — Severe Weather Risk' },
  ]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Task Duration Prediction Inputs</CardTitle>
          <CardDescription>
            Validated 1-to-1 against FastAPI <code>PredictionRequest</code> and{' '}
            <code>config.py</code> feature encoding.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PREDICTION_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset.payload)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Construction Task Type"
              options={taskOptions}
              value={form.task_type}
              error={errors.task_type}
              helperText={`Encoded automatically as task_type_code = ${taskCode >= 0 ? taskCode : '?'}`}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, task_type: e.target.value }))}
            />

            <Select
              label="Responsible Contractor"
              options={contractorOptions}
              value={form.contractor}
              error={errors.contractor}
              helperText={`Encoded automatically as contractor_code = ${contractorCode >= 0 ? contractorCode : '?'}`}
              required
              onChange={(e) => setForm((prev) => ({ ...prev, contractor: e.target.value }))}
            />

            <Input
              label="Planned Duration (Days)"
              type="number"
              min={1}
              max={365}
              step={1}
              value={form.planned_duration}
              error={errors.planned_duration}
              helperText="Integer range: 1 to 365 days"
              required
              onChange={(e) => setForm((prev) => ({ ...prev, planned_duration: e.target.value }))}
            />

            <Input
              label="Crew Size (Workers)"
              type="number"
              min={1}
              max={500}
              step={1}
              value={form.crew_size}
              error={errors.crew_size}
              helperText="Integer range: 1 to 500 workers"
              required
              onChange={(e) => setForm((prev) => ({ ...prev, crew_size: e.target.value }))}
            />

            <Input
              label="Material Cost (USD)"
              type="number"
              min={100}
              max={10000000}
              step="0.01"
              value={form.material_cost}
              error={errors.material_cost}
              helperText="Numeric range: $100 to $10,000,000"
              required
              onChange={(e) => setForm((prev) => ({ ...prev, material_cost: e.target.value }))}
            />

            <Select
              label="Weather Risk Score (1–5)"
              options={weatherOptions}
              value={form.weather_risk}
              error={errors.weather_risk}
              helperText="Model scale from 1 (low) to 5 (severe)"
              required
              onChange={(e) => setForm((prev) => ({ ...prev, weather_risk: e.target.value }))}
            />

            <Input
              label="Engineering Complexity (1–10)"
              type="number"
              min={1}
              max={10}
              step={1}
              value={form.complexity_level}
              error={errors.complexity_level}
              helperText="Integer score from 1 (simple) to 10 (very complex)"
              required
              onChange={(e) => setForm((prev) => ({ ...prev, complexity_level: e.target.value }))}
            />

            <div className="flex flex-col justify-center rounded-sm border border-border-neutral bg-ivory/60 px-3.5 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="bx-label">Exact Feature Order</span>
                <Badge variant="neutral">7 Inputs</Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-charcoal/80">
                task_type_code ({taskCode}), contractor_code ({contractorCode}), planned_duration,
                crew_size, material_cost, weather_risk, complexity_level
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-neutral pt-4">
            <Button
              type="button"
              variant="outline"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => applyPreset(PREDICTION_PRESETS[0].payload)}
            >
              Reset Default
            </Button>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              leftIcon={<Play className="h-4 w-4" />}
            >
              Predict Actual Duration
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
