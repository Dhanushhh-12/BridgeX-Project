import { RefreshCw, Thermometer } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
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

export interface WeatherChartsGridProps {
  siteLabel: string
  status: 'loading' | 'ready' | 'error'
  weather: WeatherResponse | null
  errorMessage: string | null
  onRetry: () => void
}

export function WeatherChartsGrid({
  siteLabel,
  status,
  weather,
  errorMessage,
  onRetry,
}: WeatherChartsGridProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      {/* Live Rainfall Forecast Chart */}
      <Card className="xl:col-span-7 flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Daily Rainfall Forecast &amp; Threshold Comparison</CardTitle>
            <CardDescription>
              Live Open-Meteo <code>precipitation_sum</code> for {siteLabel} (threshold line at{' '}
              {weather?.rain_threshold_mm ?? 5} mm).
            </CardDescription>
          </div>
          <Badge variant={status === 'ready' ? 'info' : 'neutral'} showDot>
            {status === 'ready' ? 'LIVE OPEN-METEO' : 'Weather API'}
          </Badge>
        </CardHeader>

        <CardContent className="flex-1">
          {status === 'loading' && (
            <LoadingIndicator label="Fetching live rainfall forecast from Open-Meteo..." />
          )}

          {status === 'error' && (
            <ErrorState
              title="Live Rainfall Forecast Unavailable"
              message={
                errorMessage ??
                'Unable to reach Open-Meteo via GET /weather. No fallback fake weather is generated.'
              }
              action={
                <Button size="sm" variant="primary" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
                  Retry Forecast
                </Button>
              }
            />
          )}

          {status === 'ready' && weather && (
            weather.daily_forecast.length === 0 ? (
              <EmptyState
                title="Empty Forecast"
                description="Open-Meteo returned zero daily rainfall records."
              />
            ) : (
              <div className="space-y-3">
                <div className="h-[235px] w-full min-w-0 sm:h-[270px]" aria-label="Daily rainfall forecast bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weather.daily_forecast.map((d) => ({
                        date: d.date.slice(5),
                        fullDate: d.date,
                        rainfall: d.rainfall_mm,
                        isRainy: d.is_rainy,
                      }))}
                      margin={{ top: 14, right: 10, left: -16, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        minTickGap={14}
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
                        formatter={(val) => [`${val ?? 0} mm`, 'Daily Rainfall']}
                        labelFormatter={(label, payload) => {
                          const full = payload?.[0]?.payload?.fullDate as string | undefined
                          return full ?? String(label)
                        }}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#DED7CB',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                      <ReferenceLine
                        y={weather.rain_threshold_mm}
                        stroke="#F0785F"
                        strokeDasharray="4 4"
                        label={{
                          value: `Threshold ${weather.rain_threshold_mm}mm`,
                          position: 'insideTopRight',
                          fill: '#183153',
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="rainfall" radius={[2, 2, 0, 0]}>
                        {weather.daily_forecast.map((day) => (
                          <Cell
                            key={day.date}
                            fill={day.is_rainy ? '#F0785F' : '#183153'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-charcoal/80">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-editorial-blue" aria-hidden="true" />
                    Dry / Below Threshold (&lt; {weather.rain_threshold_mm} mm)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-coral" aria-hidden="true" />
                    Rainy Day (&ge; {weather.rain_threshold_mm} mm)
                  </span>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Honest Temperature Trend Unavailable Card */}
      <Card className="xl:col-span-5 flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Temperature Trend &amp; Wind Telemetry</CardTitle>
            <CardDescription>
              Daily min/max air temperature and surface wind metrics.
            </CardDescription>
          </div>
          <Badge variant="neutral">Not in GET /weather</Badge>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-center">
          <EmptyState
            icon={<Thermometer className="h-5 w-5 text-sage" />}
            title="Temperature, Wind &amp; Probability Fields Not Returned Yet"
            description="weather.py currently requests only daily=precipitation_sum from Open-Meteo. Temperature curves, precipitation probability %, wind speed, and condition codes are withheld until backend support is added—never invented."
          />
        </CardContent>
      </Card>
    </div>
  )
}
