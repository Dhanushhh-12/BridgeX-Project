import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudRain,
  Info,
  MapPin,
  RefreshCw,
  Sun,
} from 'lucide-react'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Table,
  type SortDirection,
  type TableColumn,
} from '../components/ui'
import {
  ConstructionWeatherGuide,
  WeatherChartsGrid,
  WeatherRiskIndicators,
} from '../components/weather'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import { validateWeatherInputs } from '../data/weatherGuidance'
import { getWeather } from '../services/apiClient'
import type { DailyRainfallPoint, WeatherResponse } from '../types/api'

const FORECAST_DAY_OPTIONS = [
  { value: '3', label: '3 Days' },
  { value: '7', label: '7 Days (1 Week)' },
  { value: '14', label: '14 Days (2 Weeks)' },
  { value: '16', label: '16 Days (Open-Meteo Max)' },
]

export function WeatherMonitoringPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(DEMO_PROJECTS[0].id)
  const [latInput, setLatInput] = useState<string>(String(DEMO_PROJECTS[0].latitude))
  const [lonInput, setLonInput] = useState<string>(String(DEMO_PROJECTS[0].longitude))
  const [forecastDays, setForecastDays] = useState<string>('7')
  const [thresholdInput, setThresholdInput] = useState<string>('5')
  const [fieldErrors, setFieldErrors] = useState<{
    latitude?: string
    longitude?: string
    thresholdMm?: string
  }>({})

  const [activeQuery, setActiveQuery] = useState({
    siteLabel: `${DEMO_PROJECTS[0].name} (${DEMO_PROJECTS[0].location})`,
    latitude: DEMO_PROJECTS[0].latitude,
    longitude: DEMO_PROJECTS[0].longitude,
    days: 7,
    thresholdMm: 5,
  })
  const [fetchNonce, setFetchNonce] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  )

  const [weatherState, setWeatherState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: WeatherResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })

  const [sortKey, setSortKey] = useState<'date' | 'rainfall_mm'>('date')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  useEffect(() => {
    let cancelled = false
    getWeather({
      latitude: activeQuery.latitude,
      longitude: activeQuery.longitude,
      days: activeQuery.days,
      thresholdMm: activeQuery.thresholdMm,
    })
      .then((data) => {
        if (!cancelled) {
          setWeatherState({ status: 'ready', data, error: null })
          setLastUpdated(
            new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          )
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setWeatherState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err.message : 'Unable to fetch Open-Meteo forecast.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    activeQuery.days,
    activeQuery.latitude,
    activeQuery.longitude,
    activeQuery.thresholdMm,
    fetchNonce,
  ])

  const siteOptions = useMemo(
    () => [
      ...DEMO_PROJECTS.map((p) => ({
        value: p.id,
        label: `${p.name} — ${p.location} (Demo Site)`,
      })),
      { value: 'custom', label: 'Custom Coordinates (Manual Lat / Lon)' },
    ],
    [],
  )

  function handleSiteChange(nextId: string) {
    setSelectedSiteId(nextId)
    setFieldErrors({})
    if (nextId === 'custom') return

    const found = DEMO_PROJECTS.find((p) => p.id === nextId)
    if (found) {
      setLatInput(String(found.latitude))
      setLonInput(String(found.longitude))
      setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
      setActiveQuery((prev) => ({
        ...prev,
        siteLabel: `${found.name} (${found.location})`,
        latitude: found.latitude,
        longitude: found.longitude,
      }))
    }
  }

  function handleApplySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = validateWeatherInputs(latInput, lonInput, thresholdInput)
    if (!check.valid || check.latitude === undefined || check.longitude === undefined || check.thresholdMm === undefined) {
      setFieldErrors(check.errors)
      return
    }
    setFieldErrors({})
    const found = DEMO_PROJECTS.find((p) => p.id === selectedSiteId)
    const label =
      selectedSiteId !== 'custom' && found
        ? `${found.name} (${found.location})`
        : `Custom Coordinates (${check.latitude.toFixed(4)}, ${check.longitude.toFixed(4)})`

    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setActiveQuery({
      siteLabel: label,
      latitude: check.latitude,
      longitude: check.longitude,
      days: Number(forecastDays),
      thresholdMm: check.thresholdMm,
    })
  }

  function handleRefresh() {
    setWeatherState((prev) => ({ ...prev, status: 'loading', error: null }))
    setFetchNonce((n) => n + 1)
  }

  function handleSortChange(nextKey: string) {
    const typedKey = nextKey === 'rainfall_mm' ? 'rainfall_mm' : 'date'
    if (sortKey === typedKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(typedKey)
      setSortDir('asc')
    }
  }

  const sortedDailyForecast = useMemo(() => {
    const rows = weatherState.data?.daily_forecast ?? []
    return [...rows].sort((a, b) => {
      const cmp =
        sortKey === 'rainfall_mm'
          ? a.rainfall_mm - b.rainfall_mm
          : a.date.localeCompare(b.date)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [sortDir, sortKey, weatherState.data])

  const dailyColumns: TableColumn<DailyRainfallPoint>[] = [
    {
      key: 'date',
      header: 'Forecast Date',
      sortable: true,
      render: (row) => <span className="font-mono text-xs font-semibold text-editorial-blue">{row.date}</span>,
    },
    {
      key: 'rainfall_mm',
      header: 'Daily Rainfall (mm)',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-editorial-blue">
          {row.rainfall_mm.toFixed(1)} mm
        </span>
      ),
    },
    {
      key: 'threshold',
      header: 'Threshold Comparison',
      render: (row) => {
        const threshold = weatherState.data?.rain_threshold_mm ?? activeQuery.thresholdMm
        const diff = Number((row.rainfall_mm - threshold).toFixed(1))
        return (
          <span className="font-mono text-xs text-charcoal/80">
            {diff >= 0 ? `+${diff.toFixed(1)} mm above` : `${Math.abs(diff).toFixed(1)} mm below`} ({threshold} mm)
          </span>
        )
      },
    },
    {
      key: 'classification',
      header: 'Classification (count_rainy_days)',
      render: (row) =>
        row.is_rainy ? (
          <Badge variant="critical">
            <CloudRain className="h-3 w-3 text-editorial-blue" aria-hidden="true" />
            Rainy Day
          </Badge>
        ) : (
          <Badge variant="success">
            <Sun className="h-3 w-3 text-sage" aria-hidden="true" />
            Dry Window
          </Badge>
        ),
    },
    {
      key: 'unavailable',
      header: 'Temp / Wind / Precip %',
      render: () => (
        <span className="text-xs text-charcoal/65">Not in GET /weather</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence Engines"
        title="Weather Risk Monitoring"
        description="Monitor live Open-Meteo daily rainfall forecasts and threshold-based site concerns via weather.py and GET /weather."
        breadcrumbs={[{ label: 'Weather Monitoring' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border-neutral bg-surface px-3 py-1.5 text-xs text-charcoal">
              <Calendar className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
              Updated: {lastUpdated}
            </span>
            <Badge variant={weatherState.status === 'ready' ? 'info' : 'neutral'} showDot>
              {weatherState.status === 'ready' ? 'LIVE OPEN-METEO' : 'Weather API'}
            </Badge>
            <Button
              size="sm"
              variant="primary"
              isLoading={weatherState.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={handleRefresh}
            >
              Refresh Forecast
            </Button>
          </div>
        }
      />

      {/* Transparent Data Provenance Notice */}
      <Card variant="sand" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-editorial-blue">Real Weather Integration:</strong> Site selector
            coordinates come from <strong>DEMO DATA</strong> project presets (or manual coordinates
            you enter), while all rainfall numbers, daily dates, and rainy-day counts come{' '}
            <strong>live from Open-Meteo</strong> via <code>GET /weather</code> and{' '}
            <code>weather.count_rainy_days()</code>. Current conditions, temperature, wind speed, and
            precipitation probability are not returned by <code>weather.py</code> yet and are
            honestly marked unavailable.
          </p>
        </div>
      </Card>

      {/* Location, Threshold & Forecast Controls */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Site Location &amp; Threshold Controls</CardTitle>
            <CardDescription>
              Select a demo project site or custom coordinates and configure your rainfall alert
              threshold (<code>threshold_mm</code>).
            </CardDescription>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-editorial-blue">
            <MapPin className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
            {activeQuery.latitude.toFixed(4)}, {activeQuery.longitude.toFixed(4)}
          </span>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleApplySettings} noValidate className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="lg:col-span-2">
              <Select
                label="Project / Site Location"
                options={siteOptions}
                value={selectedSiteId}
                onChange={(e) => handleSiteChange(e.target.value)}
              />
            </div>

            <Input
              label="Latitude (-90 to 90)"
              type="number"
              step="0.0001"
              value={latInput}
              error={fieldErrors.latitude}
              onChange={(e) => {
                setSelectedSiteId('custom')
                setLatInput(e.target.value)
              }}
            />

            <Input
              label="Longitude (-180 to 180)"
              type="number"
              step="0.0001"
              value={lonInput}
              error={fieldErrors.longitude}
              onChange={(e) => {
                setSelectedSiteId('custom')
                setLonInput(e.target.value)
              }}
            />

            <Select
              label="Forecast Window"
              options={FORECAST_DAY_OPTIONS}
              value={forecastDays}
              onChange={(e) => setForecastDays(e.target.value)}
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Rain Threshold (mm)"
                  type="number"
                  step="0.5"
                  min={0}
                  max={200}
                  value={thresholdInput}
                  error={fieldErrors.thresholdMm}
                  onChange={(e) => setThresholdInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" size="md">
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Summary Metrics Bar */}
      <section aria-label="Rainfall Forecast Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm">
          <p className="bx-label">Weather Source</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-lg font-semibold text-editorial-blue">
            <CheckCircle2 className="h-4 w-4 text-sage" aria-hidden="true" />
            {weatherState.data?.source ?? 'Open-Meteo'}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">{activeQuery.siteLabel}</p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Total Window Rainfall</p>
          <p className="mt-1.5 text-2xl font-semibold text-editorial-blue bx-tabular">
            {weatherState.status === 'ready' && weatherState.data
              ? `${weatherState.data.total_rainfall_mm.toFixed(1)} ${weatherState.data.units}`
              : 'Unavailable'}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            Across {weatherState.data?.forecast_days ?? activeQuery.days} forecast days
          </p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Rainy Days Count</p>
          <p className="mt-1.5 text-2xl font-semibold text-coral bx-tabular">
            {weatherState.status === 'ready' && weatherState.data
              ? `${weatherState.data.rainy_days_count} / ${weatherState.data.forecast_days}`
              : 'Unavailable'}
          </p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            Days &ge; {weatherState.data?.rain_threshold_mm ?? activeQuery.thresholdMm} mm
            (<code>count_rainy_days</code>)
          </p>
        </Card>

        <Card padding="sm">
          <p className="bx-label">Current Temp &amp; Wind</p>
          <p className="mt-1.5 text-lg font-semibold text-editorial-blue">Unavailable</p>
          <p className="mt-0.5 text-[11px] text-charcoal/75">
            Not fetched by <code>weather.py</code> yet
          </p>
        </Card>
      </section>

      {/* Risk Indicators (Rainfall Live + Wind/Temp Honest Unavailable) */}
      <WeatherRiskIndicators weather={weatherState.data} status={weatherState.status} />

      {/* Charts Grid */}
      <WeatherChartsGrid
        siteLabel={activeQuery.siteLabel}
        status={weatherState.status}
        weather={weatherState.data}
        errorMessage={weatherState.error}
        onRetry={handleRefresh}
      />

      {/* Daily Weather Forecast Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Daily Weather Forecast Table</CardTitle>
            <CardDescription>
              Genuine daily records returned by <code>GET /weather</code> for{' '}
              {activeQuery.siteLabel}.
            </CardDescription>
          </div>
          <Badge variant={weatherState.status === 'ready' ? 'info' : 'neutral'}>
            {sortedDailyForecast.length} Days
          </Badge>
        </CardHeader>
        <CardContent>
          <Table
            caption="Daily rainfall forecast table from Open-Meteo"
            columns={dailyColumns}
            data={sortedDailyForecast}
            rowKey={(row) => row.date}
            isLoading={weatherState.status === 'loading'}
            sortKey={sortKey}
            sortDirection={sortDir}
            onSortChange={handleSortChange}
            emptyTitle="No daily weather records loaded"
            emptyDescription="Retry the Open-Meteo request or check that your FastAPI backend is running."
          />
        </CardContent>
      </Card>

      {/* Construction Weather Considerations */}
      <ConstructionWeatherGuide />

      {/* Missing Backend Fields Note */}
      <Card variant="ivory" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <p>
            <strong className="text-editorial-blue">Optional Backend Weather Expansion:</strong>{' '}
            To unlock live Temperature Trend Charts, High Wind Concern, Precipitation Probability %,
            and Current Conditions without changing existing rainfall contracts, extend{' '}
            <code>weather.py</code> and <code>GET /weather</code> to request Open-Meteo fields{' '}
            <code>temperature_2m_max</code>, <code>temperature_2m_min</code>,{' '}
            <code>wind_speed_10m_max</code>, <code>precipitation_probability_max</code>, and{' '}
            <code>weather_code</code>.
          </p>
        </div>
      </Card>
    </div>
  )
}
