import type { WeatherResponse } from '../types/api'

/**
 * Transparent, non-certified construction weather rules and validators
 * aligned strictly with weather.py and GET /weather in backend/api/api.py.
 */

export interface CoordinateValidationResult {
  valid: boolean
  latitude?: number
  longitude?: number
  thresholdMm?: number
  errors: {
    latitude?: string
    longitude?: string
    thresholdMm?: string
  }
}

export function validateWeatherInputs(
  latText: string,
  lonText: string,
  thresholdText: string,
): CoordinateValidationResult {
  const errors: CoordinateValidationResult['errors'] = {}

  const lat = Number(latText.trim())
  if (!latText.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.latitude = 'Latitude must be between -90 and 90 degrees.'
  }

  const lon = Number(lonText.trim())
  if (!lonText.trim() || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    errors.longitude = 'Longitude must be between -180 and 180 degrees.'
  }

  const threshold = Number(thresholdText.trim())
  if (!thresholdText.trim() || !Number.isFinite(threshold) || threshold < 0 || threshold > 200) {
    errors.thresholdMm = 'Rain threshold must be between 0 and 200 mm.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    latitude: lat,
    longitude: lon,
    thresholdMm: threshold,
    errors: {},
  }
}

export type RainfallConcernLevel = 'Low' | 'Moderate' | 'Elevated'

export interface RainfallConcernSummary {
  level: RainfallConcernLevel
  ruleTriggered: string
  peakDailyMm: number
}

/**
 * Transparent rule-of-thumb indicator computed strictly from live GET /weather output.
 * NOT an engineering safety certification or ML delay prediction.
 */
export function evaluateRainfallConcern(weather: WeatherResponse): RainfallConcernSummary {
  const peakDailyMm = weather.daily_forecast.reduce(
    (max, day) => (day.rainfall_mm > max ? day.rainfall_mm : max),
    0,
  )
  const heavySingleDayLimit = Math.max(weather.rain_threshold_mm * 3, 15)

  if (weather.rainy_days_count >= 3 || peakDailyMm >= heavySingleDayLimit) {
    return {
      level: 'Elevated',
      ruleTriggered: `${weather.rainy_days_count} rainy day(s) >= ${weather.rain_threshold_mm} mm or peak daily rainfall ${peakDailyMm.toFixed(1)} mm >= ${heavySingleDayLimit.toFixed(1)} mm.`,
      peakDailyMm,
    }
  }

  if (weather.rainy_days_count >= 1) {
    return {
      level: 'Moderate',
      ruleTriggered: `${weather.rainy_days_count} day(s) meet or exceed the ${weather.rain_threshold_mm} mm rainfall threshold.`,
      peakDailyMm,
    }
  }

  return {
    level: 'Low',
    ruleTriggered: `0 forecast days reach the ${weather.rain_threshold_mm} mm rainfall threshold.`,
    peakDailyMm,
  }
}

export interface ActivityWeatherGuidance {
  activity: string
  rainfallSensitivity: 'High' | 'Moderate'
  rainTriggerNote: string
  advisoryAction: string
}

export const CONSTRUCTION_WEATHER_GUIDANCE: ActivityWeatherGuidance[] = [
  {
    activity: 'Excavation',
    rainfallSensitivity: 'High',
    rainTriggerNote: 'Sustained rainfall >= threshold increases trench water pooling and sidewall sloughing.',
    advisoryAction: 'Verify perimeter dewatering pumps, sump drainage, and shoring inspections before shift.',
  },
  {
    activity: 'Foundation Work',
    rainfallSensitivity: 'High',
    rainTriggerNote: 'Standing water in pile boreholes or footings weakens soil bearing quality.',
    advisoryAction: 'Schedule tremie checks or temporary coverings ahead of forecast rainy days.',
  },
  {
    activity: 'Concrete Pouring',
    rainfallSensitivity: 'High',
    rainTriggerNote: 'Active rain during open pours alters surface water-cement ratio and finishing quality.',
    advisoryAction: 'Avoid unshielded deck/slab pours on days flagged >= rain threshold; stage curing tarps.',
  },
  {
    activity: 'Steel Erection',
    rainfallSensitivity: 'Moderate',
    rainTriggerNote: 'Wet steel flanges increase slip hazards; crane lifts depend primarily on wind speed (not yet in GET /weather).',
    advisoryAction: 'Check local site anemometer wind logs separately before high-elevation crane picks.',
  },
  {
    activity: 'Asphalt Paving',
    rainfallSensitivity: 'High',
    rainTriggerNote: 'Paving over damp bridge decks traps moisture and hurts hot-mix compaction bonding.',
    advisoryAction: 'Require dry base verification window before mobilizing hot-mix haul trucks.',
  },
]
