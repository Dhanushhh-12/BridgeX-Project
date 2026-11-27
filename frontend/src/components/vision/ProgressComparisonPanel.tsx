import { useState, type FormEvent } from 'react'
import { AlertTriangle, GitCompare, Info, Lock } from 'lucide-react'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { ApiClientError, postAnalyzeProgress } from '../../services/apiClient'
import type { AnalyzeProgressResponse, ClassShiftRow } from '../../types/api'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  LoadingIndicator,
  Table,
  type TableColumn,
} from '../ui'
import { ImageDropzone } from './ImageDropzone'

export interface ProgressComparisonPanelProps {
  selectedProjectLabel: string
  onComparisonComplete: (item: {
    kind: 'comparison'
    resultId: string
    summary: string
    timestamp: string
    projectLabel: string
  }) => void
}

export function ProgressComparisonPanel({
  selectedProjectLabel,
  onComparisonComplete,
}: ProgressComparisonPanelProps) {
  const [prevFile, setPrevFile] = useState<File | null>(null)
  const [currFile, setCurrFile] = useState<File | null>(null)
  const [taskDescription, setTaskDescription] = useState('')
  const [uploadPct, setUploadPct] = useState(0)

  const prevPreviewUrl = useObjectUrl(prevFile)
  const currPreviewUrl = useObjectUrl(currFile)

  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: AnalyzeProgressResponse | null
    error: string | null
    errorCode: number | null
  }>({ status: 'idle', data: null, error: null, errorCode: null })

  async function handleCompare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prevFile || !currFile) return

    setUploadPct(0)
    setState({ status: 'loading', data: null, error: null, errorCode: null })

    try {
      const response = await postAnalyzeProgress(
        {
          previousImage: prevFile,
          currentImage: currFile,
          projectId: selectedProjectLabel || undefined,
          taskDescription: taskDescription || undefined,
        },
        (pct) => setUploadPct(pct),
      )
      setState({ status: 'ready', data: response, error: null, errorCode: null })

      const obs = response.ai_visual_observations
      onComparisonComplete({
        kind: 'comparison',
        resultId: response.result_id,
        summary: `Diff ${obs.image_difference_score_pct}% · Semantic shift ${obs.semantic_region_change_pct}%`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        projectLabel: response.project_id ?? 'General',
      })
    } catch (err) {
      const code = err instanceof ApiClientError ? err.status : null
      setState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Failed to run two-photo comparison.',
        errorCode: code,
      })
    }
  }

  const shiftColumns: TableColumn<ClassShiftRow>[] = [
    {
      key: 'class_name',
      header: 'ADE20K Class',
      render: (row) => <span className="font-semibold text-editorial-blue">{row.class_name}</span>,
    },
    {
      key: 'pct_1',
      header: 'Earlier Photo %',
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.pct_1.toFixed(1)}%</span>,
    },
    {
      key: 'pct_2',
      header: 'Current Photo %',
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.pct_2.toFixed(1)}%</span>,
    },
    {
      key: 'diff_pct',
      header: 'Visual Share Shift',
      align: 'right',
      render: (row) => (
        <Badge variant={Math.abs(row.diff_pct) >= 10 ? 'warning' : 'neutral'}>
          {row.diff_pct > 0 ? `+${row.diff_pct.toFixed(1)}%` : `${row.diff_pct.toFixed(1)}%`}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Two-Photo Construction Image Comparison</CardTitle>
            <CardDescription>
              Reuses <code>compare_images.py</code>, <code>compare_segmentation.py</code>, and{' '}
              <code>progress_report.py</code> via <code>POST /analyze-progress</code>.
            </CardDescription>
          </div>
          <Badge variant="info">Visual Change Analysis</Badge>
        </CardHeader>

        <CardContent>
          <form onSubmit={(e) => void handleCompare(e)} className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ImageDropzone
                label="1. Earlier Site Photo (Baseline)"
                file={prevFile}
                disabled={state.status === 'loading'}
                onFileChange={setPrevFile}
              />
              <ImageDropzone
                label="2. Newer / Current Site Photo"
                file={currFile}
                disabled={state.status === 'loading'}
                onFileChange={setCurrFile}
              />
            </div>

            <Input
              label="Optional Task Description"
              maxLength={500}
              placeholder="e.g., Bridge pier cap curing before & after comparison"
              value={taskDescription}
              disabled={state.status === 'loading'}
              onChange={(e) => setTaskDescription(e.target.value)}
            />

            {state.status === 'loading' && (
              <div className="space-y-2 rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-editorial-blue">
                  <span>
                    {uploadPct < 100
                      ? `Uploading paired photos (${uploadPct}%)...`
                      : 'Running dual-photo pixel comparison + CPU SegFormer segmentation...'}
                  </span>
                  <span className="font-mono">{uploadPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-xs bg-sand">
                  <div
                    className="h-full bg-coral transition-[width] duration-150"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <LoadingIndicator inline size="sm" label="Comparing aligned images and masks..." />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!prevFile || !currFile || state.status === 'loading'}
                isLoading={state.status === 'loading'}
                leftIcon={<GitCompare className="h-4 w-4" />}
              >
                Compare Site Photos
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {state.status === 'error' && (
        <ErrorState
          title={
            state.errorCode === 503
              ? 'Computer Vision Model Unavailable (HTTP 503)'
              : 'Image Comparison Failed'
          }
          message={state.error ?? 'Unable to compare the two uploaded photographs.'}
        />
      )}

      {state.status === 'ready' && state.data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Side-by-Side Comparison &amp; Visual Report Summary</CardTitle>
                <CardDescription>
                  Report ID: <code className="font-mono">{state.data.result_id}</code> · Aligned
                  Dimensions: {state.data.matched_dimensions.width}×
                  {state.data.matched_dimensions.height} px
                </CardDescription>
              </div>
              <Badge variant="warning" showDot>
                {state.data.engineer_verification.verification_status}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Side-by-Side Uploaded Originals */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-sm border border-border-neutral bg-ivory/40 p-3">
                  <p className="bx-label mb-2">
                    Earlier Photo — {state.data.previous_image.original_filename}
                  </p>
                  {prevPreviewUrl && (
                    <img
                      src={prevPreviewUrl}
                      alt={`Earlier photo ${state.data.previous_image.original_filename}`}
                      className="max-h-64 w-full rounded-xs border border-border-neutral bg-surface object-contain"
                    />
                  )}
                </div>
                <div className="rounded-sm border border-border-neutral bg-ivory/40 p-3">
                  <p className="bx-label mb-2">
                    Current Photo — {state.data.current_image.original_filename}
                  </p>
                  {currPreviewUrl && (
                    <img
                      src={currPreviewUrl}
                      alt={`Current photo ${state.data.current_image.original_filename}`}
                      className="max-h-64 w-full rounded-xs border border-border-neutral bg-surface object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Three-Way Distinction Cards (Section 5) */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4">
                  <p className="bx-label">1. Visual Pixel Analysis</p>
                  <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                    {state.data.ai_visual_observations.image_difference_score_pct.toFixed(2)}% Diff
                  </p>
                  <p className="mt-1 text-xs text-charcoal/80">
                    Raw changed pixels (&gt;25 intensity):{' '}
                    <strong>
                      {state.data.ai_visual_observations.raw_changed_pixels_pct.toFixed(2)}%
                    </strong>
                  </p>
                </div>

                <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4">
                  <p className="bx-label">2. SegFormer Region Shifts</p>
                  <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                    {state.data.ai_visual_observations.semantic_region_change_pct.toFixed(2)}% Shift
                  </p>
                  <p className="mt-1 text-xs text-charcoal/80">
                    {state.data.ai_visual_observations.detected_classes_count} ADE20K classes
                    detected across both photos
                  </p>
                </div>

                <div className="rounded-sm border border-coral bg-sand/45 p-4">
                  <p className="bx-label">3. Engineer-Verified Progress</p>
                  <p className="mt-1 text-xl font-semibold text-editorial-blue">
                    {state.data.engineer_verification.verified_completion_pct !== null
                      ? `${state.data.engineer_verification.verified_completion_pct}%`
                      : 'Pending Review'}
                  </p>
                  <p className="mt-1 text-xs text-charcoal/80">
                    {state.data.engineer_verification.verification_status} (AI scores are not
                    completion %)
                  </p>
                </div>
              </div>

              {/* Top Visible Class Shifts Table */}
              <Table
                caption="Top visible ADE20K class shifts between earlier and current site photos"
                columns={shiftColumns}
                data={state.data.ai_visual_observations.top_visible_class_shifts}
                rowKey={(row) => String(row.class_id)}
              />

              {/* Server Difference Visualization Note (Security: No Path Exposure) */}
              <div className="flex items-start gap-2.5 rounded-sm border border-border-neutral bg-sand/45 p-3 text-xs text-charcoal">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
                <p>
                  <strong className="text-editorial-blue">Generated Report Reference:</strong>{' '}
                  CSV &amp; HTML comparison artifacts were saved server-side under ID{' '}
                  <code>{state.data.result_id}</code>. To preview pixel-diff and semantic overlay
                  PNG images directly inside the browser without exposing local disk paths, a safe
                  media-serving GET endpoint is required on FastAPI.
                </p>
              </div>

              {/* Lighting / Camera / Weather Warning */}
              <div className="flex items-start gap-2.5 rounded-sm border border-coral/70 bg-ivory/80 p-3 text-xs text-charcoal">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                <p>
                  <strong className="text-editorial-blue">Comparison Caveat:</strong>{' '}
                  {state.data.limitations}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {state.status === 'idle' && (
        <div className="flex items-start gap-2 rounded-sm border border-border-neutral bg-sand/45 p-3 text-xs text-charcoal/85">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <span>
            Note: Differences in sunlight, shadows, camera position, zoom level, or weather between
            the two photographs will increase pixel difference scores without necessarily indicating
            physical construction progress.
          </span>
        </div>
      )}
    </div>
  )
}
