import { CONTRACTORS, TASK_TYPES } from '../../data/mlModelMetadata'
import type { PredictionRequestPayload } from '../../types/api'

export interface PredictionFormState {
  task_type: string
  contractor: string
  planned_duration: string
  crew_size: string
  material_cost: string
  weather_risk: string
  complexity_level: string
}

export interface PredictionFormErrors {
  task_type?: string
  contractor?: string
  planned_duration?: string
  crew_size?: string
  material_cost?: string
  weather_risk?: string
  complexity_level?: string
}

export function validatePredictionForm(
  form: PredictionFormState,
):
  | { valid: true; payload: PredictionRequestPayload }
  | { valid: false; errors: PredictionFormErrors } {
  const errors: PredictionFormErrors = {}

  if (!TASK_TYPES.includes(form.task_type as (typeof TASK_TYPES)[number])) {
    errors.task_type = 'Please select a recognized construction task type.'
  }

  if (!CONTRACTORS.includes(form.contractor as (typeof CONTRACTORS)[number])) {
    errors.contractor = 'Please select a recognized contractor.'
  }

  const plannedNum = Number(form.planned_duration.trim())
  if (
    !form.planned_duration.trim() ||
    !Number.isInteger(plannedNum) ||
    plannedNum < 1 ||
    plannedNum > 365
  ) {
    errors.planned_duration = 'Planned duration must be a whole number from 1 to 365 days.'
  }

  const crewNum = Number(form.crew_size.trim())
  if (!form.crew_size.trim() || !Number.isInteger(crewNum) || crewNum < 1 || crewNum > 500) {
    errors.crew_size = 'Crew size must be a whole number from 1 to 500 workers.'
  }

  const costNum = Number(form.material_cost.trim())
  if (
    !form.material_cost.trim() ||
    !Number.isFinite(costNum) ||
    costNum < 100 ||
    costNum > 10000000
  ) {
    errors.material_cost = 'Material cost must be between $100 and $10,000,000.'
  }

  const weatherNum = Number(form.weather_risk.trim())
  if (
    !form.weather_risk.trim() ||
    !Number.isInteger(weatherNum) ||
    weatherNum < 1 ||
    weatherNum > 5
  ) {
    errors.weather_risk = 'Weather risk must be a whole number from 1 (low) to 5 (severe).'
  }

  const complexityNum = Number(form.complexity_level.trim())
  if (
    !form.complexity_level.trim() ||
    !Number.isInteger(complexityNum) ||
    complexityNum < 1 ||
    complexityNum > 10
  ) {
    errors.complexity_level = 'Complexity level must be a whole number from 1 to 10.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    payload: {
      task_type: form.task_type,
      contractor: form.contractor,
      planned_duration: plannedNum,
      crew_size: crewNum,
      material_cost: costNum,
      weather_risk: weatherNum,
      complexity_level: complexityNum,
    },
  }
}
