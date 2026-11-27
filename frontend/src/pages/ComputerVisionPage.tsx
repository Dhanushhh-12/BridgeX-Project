import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Cpu, Info, RefreshCw } from 'lucide-react'
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
  Input,
  Select,
  Table,
  Tabs,
  type TableColumn,
} from '../components/ui'
import { ProgressComparisonPanel, SingleImageAnalysisPanel } from '../components/vision'
import { SEGFORMER_MODEL_INFO, validateOptionalProjectId } from '../data/cvMetadata'
import { DEMO_PROJECTS } from '../data/demoOverviewData'
import { getHealth } from '../services/apiClient'
import type { HealthResponse } from '../types/api'

interface SessionCvHistoryItem {
  resultId: string
  kind: 'single' | 'comparison'
  projectLabel: string
  summary: string
  timestamp: string
}

export function ComputerVisionPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(DEMO_PROJECTS[0].id)
  const [customProjectTag, setCustomProjectTag] = useState('')
  const [healthNonce, setHealthNonce] = useState(0)
  const [sessionHistory, setSessionHistory] = useState<SessionCvHistoryItem[]>([])

  const [apiHealth, setApiHealth] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: HealthResponse | null
  }>({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => {
        if (!cancelled) setApiHealth({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setApiHealth({ status: 'error', data: null })
      })
    return () => {
      cancelled = true
    }
  }, [healthNonce])

  const projectOptions = useMemo(
    () => [
      ...DEMO_PROJECTS.map((p) => ({
        value: p.id,
        label: `${p.projectCode} — ${p.name} (Demo)`,
      })),
      { value: 'custom', label: 'Custom Project Identifier' },
    ],
    [],
  )

  const customError = selectedProjectId === 'custom' ? validateOptionalProjectId(customProjectTag) : null

  const activeProjectReference = useMemo(() => {
    if (selectedProjectId === 'custom') {
      return customError ? '' : customProjectTag.trim()
    }
    const found = DEMO_PROJECTS.find((p) => p.id === selectedProjectId)
    return found ? found.projectCode : ''
  }, [customError, customProjectTag, selectedProjectId])

  function addHistoryItem(item: SessionCvHistoryItem) {
    setSessionHistory((prev) => [item, ...prev].slice(0, 15))
  }

  const historyColumns: TableColumn<SessionCvHistoryItem>[] = [
    {
      key: 'resultId',
      header: 'Reference ID',
      render: (row) => <span className="font-mono text-xs font-semibold text-editorial-blue">{row.resultId}</span>,
    },
    {
      key: 'kind',
      header: 'Analysis Mode',
      render: (row) => (
        <Badge variant={row.kind === 'comparison' ? 'info' : 'neutral'}>
          {row.kind === 'comparison' ? '2-Photo Comparison' : 'Single Segmentation'}
        </Badge>
      ),
    },
    {
      key: 'projectLabel',
      header: 'Project Reference',
      render: (row) => <span className="text-xs text-charcoal">{row.projectLabel}</span>,
    },
    {
      key: 'summary',
      header: 'Observed Result',
      render: (row) => <span className="text-xs text-charcoal/85">{row.summary}</span>,
    },
    {
      key: 'timestamp',
      header: 'Session Time',
      render: (row) => <span className="font-mono text-xs text-charcoal/75">{row.timestamp}</span>,
    },
  ]

  const tabItems = [
    {
      id: 'single',
      label: 'Single-Image Segmentation',
      content: (
        <SingleImageAnalysisPanel
          selectedProjectLabel={activeProjectReference}
          onAnalysisComplete={addHistoryItem}
        />
      ),
    },
    {
      id: 'compare',
      label: 'Image Comparison & Visual Report',
      content: (
        <ProgressComparisonPanel
          selectedProjectLabel={activeProjectReference}
          onComparisonComplete={addHistoryItem}
        />
      ),
    },
    {
      id: 'history',
      label: 'Session History',
      badge: sessionHistory.length,
      content: (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Previous Analysis History (Current Session)</CardTitle>
              <CardDescription>
                Shows runs performed in this browser session. FastAPI does not expose a saved CV
                history GET endpoint yet.
              </CardDescription>
            </div>
            <Badge variant="neutral">Session-Only</Badge>
          </CardHeader>
          <CardContent>
            {sessionHistory.length === 0 ? (
              <EmptyState
                title="No CV Analyses Run Yet"
                description="Run a single-image segmentation or two-photo comparison to record results here."
              />
            ) : (
              <Table
                caption="Current session computer vision analyses"
                columns={historyColumns}
                data={sessionHistory}
                rowKey={(row) => row.resultId}
              />
            )}
          </CardContent>
        </Card>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence Engines"
        title="Computer Vision & Site Image Analysis"
        description="Run local pretrained SegFormer segmentation and two-photo visual comparison via FastAPI without external cloud AI APIs."
        breadcrumbs={[{ label: 'Computer Vision' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {apiHealth.status === 'ready' && apiHealth.data ? (
              <Badge variant="success" showDot>
                API {apiHealth.data.version}: {apiHealth.data.status}
              </Badge>
            ) : apiHealth.status === 'error' ? (
              <Badge variant="critical" showDot>
                Backend Offline
              </Badge>
            ) : (
              <Badge variant="neutral">Checking API...</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              isLoading={apiHealth.status === 'loading'}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => setHealthNonce((n) => n + 1)}
            >
              Check Backend
            </Button>
          </div>
        }
      />

      {/* Project Context Selector + Upload Policy */}
      <Card padding="sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <Select
            label="Project Reference"
            options={projectOptions}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            helperText="Tagged cleanly in backend metadata (letters, digits, '.', '_', '-')"
          />

          {selectedProjectId === 'custom' && (
            <Input
              label="Custom Project Identifier"
              maxLength={100}
              placeholder="e.g., Bridge-Span-North"
              value={customProjectTag}
              error={customError ?? undefined}
              onChange={(e) => setCustomProjectTag(e.target.value)}
            />
          )}

          <div className="rounded-sm border border-border-neutral bg-ivory/60 px-3.5 py-2.5 text-xs">
            <span className="bx-label">Active Reference Tag</span>
            <p className="mt-0.5 font-mono font-semibold text-editorial-blue">
              {activeProjectReference || 'None (Optional)'}
            </p>
          </div>
        </div>
      </Card>

      {/* Main Analysis Tabs */}
      <Tabs items={tabItems} ariaLabel="Computer vision analysis modes" />

      {/* SegFormer Model Scope & Verified Class Limitations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-editorial-blue" aria-hidden="true" />
            <div>
              <CardTitle>SegFormer Model Scope &amp; Limitations</CardTitle>
              <CardDescription>
                Verified against <code>{SEGFORMER_MODEL_INFO.checkpoint}</code> and{' '}
                <code>analyze_segmentation.py</code>.
              </CardDescription>
            </div>
          </div>
          <Badge variant="warning">Not Construction-Trained</Badge>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4 space-y-2">
            <p className="bx-label">Present General ADE20K Scene Labels</p>
            <p className="text-charcoal/85">
              {SEGFORMER_MODEL_INFO.presentRelevantLabels.join(', ')} (out of 150 general scene
              categories).
            </p>
          </div>

          <div className="rounded-sm border border-coral/60 bg-sand/40 p-4 space-y-2">
            <p className="bx-label">Absent Construction-Specific Labels</p>
            <p className="text-charcoal/85">
              <code>{SEGFORMER_MODEL_INFO.absentConstructionLabels.join(', ')}</code> do{' '}
              <strong>not</strong> exist in ADE20K. Outputs show visual scene regions—never
              certified construction progress or structural inspection verdicts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Missing Backend Endpoints Documentation */}
      <Card variant="sand" padding="sm">
        <div className="flex items-start gap-2.5 text-xs text-charcoal">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong className="text-editorial-blue">Missing CV Media &amp; History Endpoints:</strong>{' '}
            FastAPI generates mask PNGs, pixel-difference maps, and CSV/HTML reports on disk, but
            does not yet expose safe GET routes to stream those generated images or list past CV
            records. Future backend routes (<code>GET /api/v1/reports</code> and{' '}
            <code>GET /api/v1/cv/assets/{'{result_id}/{asset_name}'}</code> with strict allowlist
            validation) are required to render generated mask PNGs inside the browser without
            exposing local server paths.
          </p>
        </div>
      </Card>

      <div className="flex items-start gap-2 text-xs text-charcoal/75">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-editorial-blue" aria-hidden="true" />
        <span>
          Security active: Browser checks file binary magic bytes + 10 MB limit; FastAPI re-verifies
          actual JPEG/PNG bytes via Pillow <code>verify()</code>, strips EXIF orientation safely, and
          generates random UUID filenames.
        </span>
      </div>
    </div>
  )
}
