import { CloudRain, Eye, RefreshCw, Thermometer } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SAVED_CV_REPORTS, type SavedCvReportSummary } from '../../data/analyticsDataset'
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
  Table,
  type TableColumn,
} from '../ui'

export interface WeatherAndCvAnalyticsSectionProps {
  siteLabel: string
  weatherStatus: 'loading' | 'ready' | 'error'
  weather: WeatherResponse | null
  weatherError: string | null
  onRetryWeather: () => void
  reduceMotion: boolean
}

export function WeatherAndCvAnalyticsSection({
  siteLabel,
  weatherStatus,
  weather,
  weatherError,
  onRetryWeather,
  reduceMotion,
}: WeatherAndCvAnalyticsSectionProps) {
  const cvColumns: TableColumn<SavedCvReportSummary>[] = [
    {
      key: 'reportName',
      header: 'Saved Report File',
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-editorial-blue">{row.reportName}</p>
          <p className="text-[11px] text-charcoal/70">{row.photoPairLabel}</p>
        </div>
      ),
    },
    {
      key: 'recordedAt',
      header: 'Timestamp',
      render: (row) => <span className="font-mono text-xs">{row.recordedAt}</span>,
    },
    {
      key: 'imageDiffScorePct',
      header: 'Image Diff',
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.imageDiffScorePct.toFixed(1)}%</span>,
    },
    {
      key: 'semanticRegionChangePct',
      header: 'Semantic Shift',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs">{row.semanticRegionChangePct.toFixed(2)}%</span>
      ),
    },
    {
      key: 'visibleChangesSummary',
      header: 'Top Observed ADE20K Shifts',
      render: (row) => <span className="text-xs text-charcoal/85">{row.visibleChangesSummary}</span>,
    },
    {
      key: 'validationStatus',
      header: 'Engineer Status',
      render: (row) => <Badge variant="warning">{row.validationStatus}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Weather Trend + Honest Temperature Unavailable */}
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8 flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Live Rainfall Trend Analytics</CardTitle>
              <CardDescription>
                Open-Meteo daily rainfall curve for {siteLabel} (<code>GET /weather</code>).
              </CardDescription>
            </div>
            <Badge variant={weatherStatus === 'ready' ? 'info' : 'neutral'} showDot>
              {weatherStatus === 'ready' ? 'LIVE OPEN-METEO' : 'Weather API'}
            </Badge>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {weatherStatus === 'loading' && (
              <LoadingIndicator label="Loading live weather trend..." />
            )}

            {weatherStatus === 'error' && (
              <ErrorState
                title="Live Weather Analytics Unavailable"
                message={weatherError ?? 'Open-Meteo weather could not be loaded.'}
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={onRetryWeather}
                  >
                    Retry
                  </Button>
                }
              />
            )}

            {weatherStatus === 'ready' && weather && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                    <p className="bx-label">Window Rainfall</p>
                    <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                      {weather.total_rainfall_mm.toFixed(1)} {weather.units}
                    </p>
                  </div>
                  <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                    <p className="bx-label">Rainy Days</p>
                    <p className="mt-1 text-lg font-semibold text-coral bx-tabular">
                      {weather.rainy_days_count} / {weather.forecast_days}
                    </p>
                  </div>
                  <div className="rounded-sm border border-border-neutral bg-ivory/70 p-3">
                    <p className="bx-label">Threshold</p>
                    <p className="mt-1 text-lg font-semibold text-editorial-blue bx-tabular">
                      &ge; {weather.rain_threshold_mm} mm
                    </p>
                  </div>
                </div>

                <div className="h-[205px] w-full" aria-label="Rainfall forecast area trend chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={weather.daily_forecast.map((d) => ({
                        date: d.date.slice(5),
                        rainfall: d.rainfall_mm,
                      }))}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={{ stroke: '#DED7CB' }} />
                      <YAxis unit="mm" tick={{ fill: '#292D32', fontSize: 11 }} axisLine={false} />
                      <Tooltip
                        formatter={(v) => [`${v ?? 0} mm`, 'Precipitation']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#DED7CB',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="rainfall"
                        name="Daily Rainfall (mm)"
                        stroke="#183153"
                        fill="#183153"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        isAnimationActive={!reduceMotion}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center gap-2 text-xs text-charcoal/80">
                  <CloudRain className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
                  <span>
                    Observation: {weather.rainy_days_count} day(s) reach the{' '}
                    {weather.rain_threshold_mm} mm outdoor construction threshold over the next{' '}
                    {weather.forecast_days} days.
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-4 flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Temperature Trend</CardTitle>
              <CardDescription>Daily temperature analytics.</CardDescription>
            </div>
            <Badge variant="neutral">Unavailable</Badge>
          </CardHeader>
          <CardContent className="flex-1 flex items-center">
            <EmptyState
              icon={<Thermometer className="h-5 w-5 text-sage" />}
              title="Temperature Not Provided by weather.py"
              description="Open-Meteo integration currently requests daily=precipitation_sum only. Temperature trend charts remain withheld until weather.py fetches temperature_2m_max/min."
            />
          </CardContent>
        </Card>
      </div>

      {/* Computer Vision Saved Reports Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-coral" aria-hidden="true" />
            <div>
              <CardTitle>Computer Vision Comparison Archive</CardTitle>
              <CardDescription>
                Verified visual comparison metrics read from <code>data/images/reports/*.csv</code>{' '}
                (AI pixel observations only—never verified completion percentages).
              </CardDescription>
            </div>
          </div>
          <Badge variant="info">SAVED CV CSV ({SAVED_CV_REPORTS.length})</Badge>
        </CardHeader>
        <CardContent>
          <Table
            caption="Saved computer vision comparison CSV report metrics"
            columns={cvColumns}
            data={SAVED_CV_REPORTS}
            rowKey={(row) => row.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
