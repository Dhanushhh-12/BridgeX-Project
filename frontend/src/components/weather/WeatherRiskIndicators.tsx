import { CloudRain, Thermometer, Wind } from 'lucide-react'
import { evaluateRainfallConcern } from '../../data/weatherGuidance'
import type { WeatherResponse } from '../../types/api'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'

export interface WeatherRiskIndicatorsProps {
  weather: WeatherResponse | null
  status: 'loading' | 'ready' | 'error'
}

export function WeatherRiskIndicators({ weather, status }: WeatherRiskIndicatorsProps) {
  const rainfallConcern = status === 'ready' && weather ? evaluateRainfallConcern(weather) : null

  return (
    <section aria-label="Weather Risk Indicators" className="grid gap-4 lg:grid-cols-3">
      {/* 1. Rainfall Concern (Supported Live by GET /weather) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-coral" aria-hidden="true" />
            <CardTitle>Rainfall Concern</CardTitle>
          </div>
          {rainfallConcern ? (
            <Badge
              variant={
                rainfallConcern.level === 'Elevated'
                  ? 'critical'
                  : rainfallConcern.level === 'Moderate'
                    ? 'warning'
                    : 'success'
              }
              showDot
            >
              {rainfallConcern.level}
            </Badge>
          ) : (
            <Badge variant="neutral">{status === 'loading' ? 'Checking...' : 'Unavailable'}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {rainfallConcern && weather ? (
            <>
              <p className="font-medium text-editorial-blue">
                Rule Evaluated ({weather.rainy_days_count} / {weather.forecast_days} rainy days):
              </p>
              <p className="text-charcoal/85">{rainfallConcern.ruleTriggered}</p>
              <p className="rounded-xs border border-border-neutral bg-ivory/60 px-2.5 py-1.5 text-[11px] text-charcoal/75">
                Advisory planning rule only—not a verified ML delay prediction or safety sign-off.
              </p>
            </>
          ) : (
            <p className="text-charcoal/75">
              Waiting for live <code>GET /weather</code> rainfall measurements before calculating
              concern level.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2. High Wind Concern (Honest Unavailable State — Requires weather.py update) */}
      <Card variant="sand">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
            <CardTitle>High Wind Concern</CardTitle>
          </div>
          <Badge variant="neutral">Unavailable</Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-charcoal/85">
          <CardDescription className="mt-0 text-charcoal/85">
            Wind speed data is not currently fetched by <code>weather.py</code> or returned by{' '}
            <code>GET /weather</code>.
          </CardDescription>
          <p className="text-[11px] text-charcoal/75">
            Requires adding <code>wind_speed_10m_max</code> to Open-Meteo daily parameters before a
            wind threshold indicator can be computed honestly.
          </p>
        </CardContent>
      </Card>

      {/* 3. Temperature Concern (Honest Unavailable State — Requires weather.py update) */}
      <Card variant="sand">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
            <CardTitle>Temperature Concern</CardTitle>
          </div>
          <Badge variant="neutral">Unavailable</Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-charcoal/85">
          <CardDescription className="mt-0 text-charcoal/85">
            Air temperature data is not currently fetched by <code>weather.py</code> or returned by{' '}
            <code>GET /weather</code>.
          </CardDescription>
          <p className="text-[11px] text-charcoal/75">
            Requires adding <code>temperature_2m_max</code> / <code>temperature_2m_min</code> to
            Open-Meteo daily parameters before thermal curing alerts can be calculated.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
