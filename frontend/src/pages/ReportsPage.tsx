import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  RefreshCw,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/layout'
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
  Input,
  LoadingIndicator,
  Select,
  Table,
  type TableColumn,
} from '../components/ui'
import { cn } from '../lib/cn'
import {
  downloadReportExport,
  getReportsCatalog,
  postReportPreview,
} from '../services/apiClient'
import type {
  ReportCatalogItem,
  ReportGenerationPayload,
  ReportPreviewResponse,
  ReportsCatalogResponse,
} from '../types/api'

const WEATHER_DAY_OPTIONS = [
  { value: '3', label: '3 Days' },
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '16', label: '16 Days (Max)' },
]

const ROW_LIMIT_OPTIONS = [
  { value: '25', label: '25 rows' },
  { value: '50', label: '50 rows' },
  { value: '200', label: '200 rows' },
  { value: '6000', label: 'All 6,000 CSV rows (Full Export)' },
]

export function ReportsPage() {
  const [catalogState, setCatalogState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: ReportsCatalogResponse | null
    error: string | null
  }>({ status: 'loading', data: null, error: null })
  const [catalogNonce, setCatalogNonce] = useState(0)

  const [selectedReportType, setSelectedReportType] = useState('construction_progress')
  const [selectedProjectId, setSelectedProjectId] = useState('ALL')
  const [selectedTaskType, setSelectedTaskType] = useState('')
  const [selectedContractor, setSelectedContractor] = useState('')
  const [weatherDays, setWeatherDays] = useState('7')
  const [thresholdMm, setThresholdMm] = useState('5')
  const [maxRows, setMaxRows] = useState('50')

  const [previewState, setPreviewState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: ReportPreviewResponse | null
    error: string | null
  }>({ status: 'idle', data: null, error: null })

  const [exportStatus, setExportStatus] = useState<{
    busy: 'pdf' | 'csv' | null
    successMessage: string | null
    errorMessage: string | null
  }>({ busy: null, successMessage: null, errorMessage: null })

  useEffect(() => {
    let cancelled = false
    getReportsCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalogState({ status: 'ready', data, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogState({
            status: 'error',
            data: null,
            error:
              err instanceof Error
                ? err.message
                : 'Unable to load reports catalog from FastAPI.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [catalogNonce])

  const selectedCatalogItem: ReportCatalogItem | null = useMemo(() => {
    return (
      catalogState.data?.reports.find((r) => r.report_type === selectedReportType) ?? null
    )
  }, [catalogState.data, selectedReportType])

  function buildRequestPayload(): ReportGenerationPayload {
    const threshold = Number(thresholdMm)
    return {
      report_type: selectedReportType,
      project_id: selectedProjectId,
      days: Number(weatherDays),
      threshold_mm: Number.isFinite(threshold) && threshold >= 0 ? threshold : 5.0,
      task_type: selectedTaskType || null,
      contractor: selectedContractor || null,
      max_rows: Number(maxRows),
    }
  }

  async function handleGeneratePreview() {
    if (selectedCatalogItem && !selectedCatalogItem.available) {
      setPreviewState({
        status: 'error',
        data: null,
        error:
          selectedCatalogItem.unavailable_reason ??
          'Selected report is not supported by current backend storage.',
      })
      return
    }

    setExportStatus((prev) => ({ ...prev, successMessage: null, errorMessage: null }))
    setPreviewState({ status: 'loading', data: null, error: null })

    try {
      const response = await postReportPreview(buildRequestPayload())
      setPreviewState({ status: 'ready', data: response, error: null })
    } catch (err) {
      setPreviewState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to generate report preview.',
      })
    }
  }

  async function handleExport(format: 'pdf' | 'csv') {
    if (selectedCatalogItem && !selectedCatalogItem.available) {
      setExportStatus({
        busy: null,
        successMessage: null,
        errorMessage:
          selectedCatalogItem.unavailable_reason ??
          'Cannot export an unavailable report type.',
      })
      return
    }

    setExportStatus({ busy: format, successMessage: null, errorMessage: null })
    try {
      const result = await downloadReportExport(format, buildRequestPayload())
      setExportStatus({
        busy: null,
        successMessage: `Downloaded ${result.filename} (${(result.sizeBytes / 1024).toFixed(1)} KB).`,
        errorMessage: null,
      })
    } catch (err) {
      setExportStatus({
        busy: null,
        successMessage: null,
        errorMessage:
          err instanceof Error ? err.message : `Failed to download ${format.toUpperCase()} report.`,
      })
    }
  }

  const projectOptions = useMemo(() => {
    const list = catalogState.data?.projects ?? []
    return list.map((p) => ({
      value: p.project_id,
      label: `${p.project_id} — ${p.name}`,
    }))
  }, [catalogState.data])

  const taskTypeOptions = useMemo(
    () => [
      { value: '', label: 'All 8 Construction Stages' },
      ...(catalogState.data?.task_types ?? []).map((t) => ({ value: t, label: t })),
    ],
    [catalogState.data],
  )

  const contractorOptions = useMemo(
    () => [
      { value: '', label: 'All 5 Contractors' },
      ...(catalogState.data?.contractors ?? []).map((c) => ({ value: c, label: c })),
    ],
    [catalogState.data],
  )

  const previewChartRows = useMemo(() => {
    const chart = previewState.data?.chart
    if (!chart) return []
    return chart.labels.map((label, idx) => {
      const entry: Record<string, string | number> = { name: label }
      chart.series.forEach((s) => {
        entry[s.name] = s.values[idx] ?? 0
      })
      return entry
    })
  }, [previewState.data])

  const previewColumns: TableColumn<string[]>[] = useMemo(() => {
    const cols = previewState.data?.columns ?? []
    return cols.map((colTitle, idx) => ({
      key: `col-${idx}`,
      header: colTitle,
      render: (row: string[]) => (
        <span className="text-xs text-charcoal">{row[idx] ?? '—'}</span>
      ),
    }))
  }, [previewState.data])

  const isUnavailableReport = Boolean(selectedCatalogItem && !selectedCatalogItem.available)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance & Reporting"
        title="Reports & Exports"
        description="Generate server-rendered ReportLab PDF dossiers and formula-safe UTF-8 CSV exports strictly from available backend data."
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={catalogState.status === 'ready' ? 'success' : 'neutral'} showDot>
              {catalogState.status === 'ready' ? 'Report Engine Ready' : 'Checking Catalog...'}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => {
                setCatalogState((prev) => ({ ...prev, status: 'loading', error: null }))
                setCatalogNonce((n) => n + 1)
              }}
            >
              Reload Catalog
            </Button>
          </div>
        }
      />

      {catalogState.status === 'loading' && (
        <Card>
          <LoadingIndicator label="Loading available report types from FastAPI..." />
        </Card>
      )}

      {catalogState.status === 'error' && (
        <ErrorState
          title="Reports Backend Unavailable"
          message={
            catalogState.error ??
            'Start FastAPI (`python -m uvicorn backend.api.api:app --reload`) to generate PDF and CSV reports.'
          }
          action={
            <Button size="sm" variant="primary" onClick={() => setCatalogNonce((n) => n + 1)}>
              Retry Connection
            </Button>
          }
        />
      )}

      {catalogState.status === 'ready' && catalogState.data && (
        <>
          {/* Available & Unavailable Report Types Catalog */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Available Report Types (Select One)</CardTitle>
                <CardDescription>
                  Only reports backed by genuine datasets, trained ML, live weather, or saved CV
                  files are enabled. Unsupported reports are explicitly marked Unavailable.
                </CardDescription>
              </div>
              <Badge variant="info">
                {catalogState.data.reports.filter((r) => r.available).length} /{' '}
                {catalogState.data.reports.length} Available
              </Badge>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {catalogState.data.reports.map((rep) => {
                const isSelected = rep.report_type === selectedReportType
                return (
                  <button
                    key={rep.report_type}
                    type="button"
                    onClick={() => {
                      setSelectedReportType(rep.report_type)
                      setExportStatus({ busy: null, successMessage: null, errorMessage: null })
                      setPreviewState({ status: 'idle', data: null, error: null })
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex flex-col justify-between rounded-sm border p-4 text-left transition-colors duration-150',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue',
                      isSelected
                        ? 'border-editorial-blue bg-sand/75'
                        : 'border-border-neutral bg-ivory/45 hover:bg-sand/40',
                      !rep.available && 'opacity-80',
                    )}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-editorial-blue">
                          {rep.title}
                        </span>
                        <Badge variant={rep.available ? 'success' : 'neutral'}>
                          {rep.available ? 'Available' : 'Unavailable'}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-charcoal/80">{rep.description}</p>
                    </div>
                    <p className="mt-3 border-t border-border-neutral pt-2 font-mono text-[10px] text-charcoal/70">
                      {rep.data_source}
                    </p>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Report Parameters & Export Controls */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Report Parameters &amp; Export Controls</CardTitle>
                <CardDescription>
                  Configure target filters, preview real server output, and export formatted PDF or
                  UTF-8 CSV.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {isUnavailableReport && selectedCatalogItem && (
                <ErrorState
                  compact
                  title="Report Currently Unavailable"
                  message={
                    selectedCatalogItem.unavailable_reason ??
                    'Required backend tables do not exist yet.'
                  }
                />
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Select
                  label="Project Reference"
                  options={projectOptions}
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                />

                {(selectedReportType === 'construction_progress' ||
                  selectedReportType === 'project_analytics' ||
                  selectedReportType === 'ml_prediction') && (
                  <Select
                    label="Contractor Filter"
                    options={contractorOptions}
                    value={selectedContractor}
                    onChange={(e) => setSelectedContractor(e.target.value)}
                  />
                )}

                {(selectedReportType === 'construction_progress' ||
                  selectedReportType === 'project_analytics') && (
                  <Select
                    label="Construction Stage"
                    options={taskTypeOptions}
                    value={selectedTaskType}
                    onChange={(e) => setSelectedTaskType(e.target.value)}
                  />
                )}

                {selectedReportType === 'construction_progress' && (
                  <Select
                    label="Dataset Row Limit"
                    options={ROW_LIMIT_OPTIONS}
                    value={maxRows}
                    onChange={(e) => setMaxRows(e.target.value)}
                    helperText="PDF safely caps rendered rows at 250; CSV includes up to 6,000."
                  />
                )}

                {selectedReportType === 'weather_risk' && (
                  <>
                    <Select
                      label="Forecast Window"
                      options={WEATHER_DAY_OPTIONS}
                      value={weatherDays}
                      onChange={(e) => setWeatherDays(e.target.value)}
                    />
                    <Input
                      label="Rain Threshold (mm)"
                      type="number"
                      min={0}
                      max={500}
                      step="0.5"
                      value={thresholdMm}
                      onChange={(e) => setThresholdMm(e.target.value)}
                    />
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-neutral pt-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-charcoal/75">
                  <Info className="h-3.5 w-3.5 text-editorial-blue" aria-hidden="true" />
                  Date-range calendar filtering is omitted where backend task records lack date
                  timestamps.
                </span>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                  <Button
                    variant="secondary"
                    disabled={isUnavailableReport || previewState.status === 'loading'}
                    isLoading={previewState.status === 'loading'}
                    leftIcon={<FileText className="h-4 w-4" />}
                    onClick={() => void handleGeneratePreview()}
                    className="w-full sm:w-auto"
                  >
                    Generate Preview
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isUnavailableReport || exportStatus.busy !== null}
                    isLoading={exportStatus.busy === 'pdf'}
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={() => void handleExport('pdf')}
                    className="w-full sm:w-auto"
                  >
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isUnavailableReport || exportStatus.busy !== null}
                    isLoading={exportStatus.busy === 'csv'}
                    leftIcon={<FileSpreadsheet className="h-4 w-4" />}
                    onClick={() => void handleExport('csv')}
                    className="w-full sm:w-auto"
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              {exportStatus.successMessage && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-sm border border-sage bg-ivory px-4 py-2.5 text-xs font-medium text-editorial-blue"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                  <span>{exportStatus.successMessage}</span>
                </div>
              )}

              {exportStatus.errorMessage && (
                <ErrorState
                  compact
                  title="Export Failed"
                  message={exportStatus.errorMessage}
                />
              )}
            </CardContent>
          </Card>

          {/* Report Preview Pane */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Live Report Preview</CardTitle>
                <CardDescription>
                  Previews the exact executive summary, chart series, and records streamed into PDF
                  and CSV files.
                </CardDescription>
              </div>
              {previewState.data && (
                <Badge variant="info">{previewState.data.generated_at}</Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-5">
              {previewState.status === 'idle' && (
                <EmptyState
                  icon={<FileText className="h-5 w-5 text-editorial-blue" />}
                  title="No Report Preview Generated Yet"
                  description="Pick an available report type above and click Generate Preview, or export directly as PDF or CSV."
                />
              )}

              {previewState.status === 'loading' && (
                <LoadingIndicator label="Building report preview from FastAPI..." />
              )}

              {previewState.status === 'error' && (
                <ErrorState
                  title="Could Not Generate Preview"
                  message={previewState.error ?? 'Report generation failed.'}
                />
              )}

              {previewState.status === 'ready' && previewState.data && (
                <>
                  <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-editorial-blue">
                        {previewState.data.title}
                      </h3>
                      <Badge variant="neutral">{previewState.data.data_source}</Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-charcoal">
                      {previewState.data.executive_summary}
                    </p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {previewState.data.metrics.map((m) => (
                      <div
                        key={m.label}
                        className="rounded-sm border border-border-neutral bg-surface p-3"
                      >
                        <p className="bx-label">{m.label}</p>
                        <p className="mt-1 text-base font-semibold text-editorial-blue bx-tabular">
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Preview Chart (Recharts matching PDF vector bar chart) */}
                  {previewState.data.chart && previewChartRows.length > 0 && (
                    <div className="rounded-sm border border-border-neutral bg-surface p-3.5 sm:p-4">
                      <p className="bx-label mb-3">{previewState.data.chart.title}</p>
                      <div className="h-[220px] w-full min-w-0 sm:h-[235px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={previewChartRows}
                            margin={{ top: 8, right: 10, left: -16, bottom: 4 }}
                          >
                            <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" vertical={false} />
                            <XAxis
                              dataKey="name"
                              minTickGap={14}
                              tickFormatter={(val) => String(val).slice(0, 10)}
                              tick={{ fill: '#292D32', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: '#292D32', fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#FFFFFF',
                                borderColor: '#DED7CB',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {previewState.data.chart.series.map((s, idx) => (
                              <Bar
                                key={s.name}
                                dataKey={s.name}
                                fill={idx === 0 ? '#183153' : idx === 1 ? '#F0785F' : '#8B9B91'}
                                radius={[2, 2, 0, 0]}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Preview Table (Display first 50 rows cleanly inside UI) */}
                  <Table
                    caption="Report preview records"
                    columns={previewColumns}
                    data={previewState.data.rows.slice(0, 50)}
                    rowKey={(_, idx) => `row-${idx}`}
                    emptyTitle="No rows matched filter criteria"
                    emptyDescription="Adjust contractor or construction stage filters."
                  />

                  {previewState.data.rows.length > 50 && (
                    <p className="text-xs text-charcoal/75">
                      Preview displays the first 50 of {previewState.data.rows.length.toLocaleString()}{' '}
                      matched rows. Use <strong>Export CSV</strong> for all rows.
                    </p>
                  )}

                  <div className="flex items-start gap-2 rounded-sm border border-coral/60 bg-sand/45 p-3 text-xs text-charcoal">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                    <p>
                      <strong className="text-editorial-blue">Scope Disclaimer:</strong>{' '}
                      {previewState.data.limitations}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
