import { CloudRain, RefreshCw } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeatherResponse } from '../../types/api'
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

export interface WeatherRiskCardProps {
  siteLabel: string
  status: 'loading' | 'ready' | 'error'
  errorMessage: string | null
  weather: WeatherResponse | null
  onRetry: () => void
}

export function WeatherRiskCard({
  siteLabel,
  status,
  errorMessage,
  weather,
  onRetry,
}: WeatherRiskCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Weather Risk Overview</CardTitle>
          <CardDescription>
            Live Open-Meteo rainfall forecast for {siteLabel} (<code>GET /weather</code>).
          </CardDescription>
        </div>
        <Badge variant={status === 'ready' ? 'info' : 'neutral'} showDot>
          {status === 'ready' ? 'LIVE OPEN-METEO' : 'Weather API'}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {status === 'loading' && (
          <LoadingIndicator label="Fetching live Open-Meteo rainfall forecast..." />
        )}

        {status === 'error' && (
          <ErrorState
            title="Live Weather Unavailable"
            message={
              errorMessage ??
              'Open-Meteo weather forecast could not be loaded. No placeholder forecast is displayed.'
            }
            action={
              <Button
                size="sm"
                variant="primary"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={onRetry}
              >
                Retry Weather Fetch
              </Button>
            }
          />
        )}

        {status === 'ready' && weather && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">Window</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {weather.forecast_days} days
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">Rainy Days</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {weather.rainy_days_count} / {weather.forecast_days}
                </p>
                <p className="text-[11px] text-charcoal/70">
                  &ge; {weather.rain_threshold_mm} mm threshold
                </p>
              </div>
              <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <p className="bx-label">Total Rain</p>
                <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                  {weather.total_rainfall_mm.toFixed(1)} {weather.units}
                </p>
              </div>
            </div>

            {weather.daily_forecast.length === 0 ? (
              <EmptyState
                title="Empty forecast window"
                description="No daily rainfall points were returned for this coordinate."
              />
            ) : (
              <div className="h-[200px] w-full" aria-label="Daily rainfall forecast chart in millimeters">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weather.daily_forecast.map((d) => ({
                      day: d.date.slice(5),
                      rainfall: d.rainfall_mm,
                      isRainy: d.is_rainy,
                    }))}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={{ stroke: '#DED7CB' }}
                      tickLine={false}
                    />
                    <YAxis
                      unit="mm"
                      tick={{ fill: '#292D32', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val) => [`${val ?? 0} mm`, 'Precipitation']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#DED7CB',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="rainfall" radius={[2, 2, 0, 0]}>
                      {weather.daily_forecast.map((entry) => (
                        <Cell
                          key={entry.date}
                          fill={entry.is_rainy ? '#F0785F' : '#183153'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex items-start gap-2.5 rounded-sm border border-border-neutral bg-sand/55 p-3 text-xs text-charcoal">
              <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <p>
                {weather.rainy_days_count > 0 ? (
                  <>
                    <strong className="text-editorial-blue">Field Guidance:</strong>{' '}
                    {weather.rainy_days_count} day(s) exceed {weather.rain_threshold_mm} mm
                    precipitation. Inspect drainage, excavation shoring, and concrete/asphalt
                    curing windows before scheduling exposed outdoor pours.
                  </>
                ) : (
                  <>
                    <strong className="text-editorial-blue">Field Guidance:</strong> Dry window
                    forecasted (&lt; {weather.rain_threshold_mm} mm/day). Standard outdoor concrete
                    pouring and paving schedules remain weather-favorable.
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
