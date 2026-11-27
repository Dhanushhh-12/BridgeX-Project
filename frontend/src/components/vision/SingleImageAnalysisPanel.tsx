import { useState, type FormEvent } from 'react'
import { Camera, CheckCircle2, Info, Lock } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SEGFORMER_MODEL_INFO } from '../../data/cvMetadata'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { ApiClientError, postAnalyzeImage } from '../../services/apiClient'
import type { AnalyzeImageResponse, DetectedClassRow } from '../../types/api'
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
  Table,
  type TableColumn,
} from '../ui'
import { ImageDropzone } from './ImageDropzone'

export interface SingleImageAnalysisPanelProps {
  selectedProjectLabel: string
  onAnalysisComplete: (item: {
    kind: 'single'
    resultId: string
    summary: string
    timestamp: string
    projectLabel: string
  }) => void
}

export function SingleImageAnalysisPanel({
  selectedProjectLabel,
  onAnalysisComplete,
}: SingleImageAnalysisPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [uploadPct, setUploadPct] = useState(0)
  const previewUrl = useObjectUrl(selectedFile)

  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error'
    data: AnalyzeImageResponse | null
    error: string | null
    errorCode: number | null
  }>({ status: 'idle', data: null, error: null, errorCode: null })

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) return

    setUploadPct(0)
    setState({ status: 'loading', data: null, error: null, errorCode: null })

    try {
      const response = await postAnalyzeImage(
        {
          file: selectedFile,
          projectId: selectedProjectLabel || undefined,
          description: description || undefined,
        },
        (pct) => setUploadPct(pct),
      )

      setState({ status: 'ready', data: response, error: null, errorCode: null })
      const topLabel = response.detected_classes[0]
        ? `${response.detected_classes[0].predicted_class_name} (${response.detected_classes[0].percentage_of_image_pixels}%)`
        : `${response.detected_classes_count} classes`

      onAnalysisComplete({
        kind: 'single',
        resultId: response.result_id,
        summary: `Single segmentation: ${topLabel}`,
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
        error: err instanceof Error ? err.message : 'Failed to analyze uploaded image.',
        errorCode: code,
      })
    }
  }

  const classColumns: TableColumn<DetectedClassRow>[] = [
    {
      key: 'id',
      header: 'ADE20K ID',
      render: (row) => <span className="font-mono text-xs">{row.predicted_class_id}</span>,
    },
    {
      key: 'name',
      header: 'Detected Class Label',
      render: (row) => (
        <span className="font-semibold text-editorial-blue">{row.predicted_class_name}</span>
      ),
    },
    {
      key: 'pixels',
      header: 'Pixel Count',
      align: 'right',
      render: (row) => <span className="font-mono text-xs">{row.pixel_count.toLocaleString()}</span>,
    },
    {
      key: 'share',
      header: 'Image Pixel Share',
      align: 'right',
      render: (row) => (
        <Badge variant="neutral">{row.percentage_of_image_pixels.toFixed(2)}%</Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Single-Image Semantic Segmentation</CardTitle>
            <CardDescription>
              Uploads a site photograph to <code>POST /analyze-image</code> for{' '}
              <code>{SEGFORMER_MODEL_INFO.checkpoint}</code> classification.
            </CardDescription>
          </div>
          <Badge variant="info">ADE20K Pretrained</Badge>
        </CardHeader>

        <CardContent>
          <form onSubmit={(e) => void handleAnalyze(e)} className="space-y-4">
            <ImageDropzone
              label="Construction Site Photograph"
              file={selectedFile}
              disabled={state.status === 'loading'}
              onFileChange={(f) => {
                setSelectedFile(f)
                if (state.status !== 'idle') {
                  setState({ status: 'idle', data: null, error: null, errorCode: null })
                }
              }}
            />

            <Input
              label="Optional Description"
              maxLength={500}
              placeholder="e.g., North abutment concrete formwork inspection view"
              value={description}
              disabled={state.status === 'loading'}
              onChange={(e) => setDescription(e.target.value)}
            />

            {state.status === 'loading' && (
              <div className="space-y-2 rounded-sm border border-border-neutral bg-ivory/70 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-editorial-blue">
                  <span>
                    {uploadPct < 100
                      ? `Uploading image (${uploadPct}%)...`
                      : 'Upload complete — Running CPU SegFormer segmentation...'}
                  </span>
                  <span className="font-mono">{uploadPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-xs bg-sand">
                  <div
                    className="h-full bg-coral transition-[width] duration-150"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <LoadingIndicator inline size="sm" label="Processing image pixels on local CPU..." />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedFile || state.status === 'loading'}
                isLoading={state.status === 'loading'}
                leftIcon={<Camera className="h-4 w-4" />}
              >
                Run Segmentation Analysis
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
              : state.errorCode === 413
                ? 'Uploaded Image Exceeds 10 MB Limit'
                : 'Image Analysis Failed'
          }
          message={state.error ?? 'Could not complete /analyze-image request.'}
        />
      )}

      {state.status === 'ready' && state.data && (
        <div className="space-y-6">
          {/* Output Comparison Summary (No Server Path Exposure) */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Segmentation Output Summary</CardTitle>
                <CardDescription>
                  Reference ID: <code className="font-mono">{state.data.result_id}</code> · Format:{' '}
                  {state.data.image_format} · Analyzed at {state.data.analyzed_dimensions.width}×
                  {state.data.analyzed_dimensions.height} px
                </CardDescription>
              </div>
              <Badge variant="success" showDot>
                <CheckCircle2 className="h-3 w-3 text-sage" aria-hidden="true" />
                {state.data.segmentation_status}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-sm border border-border-neutral bg-ivory/40 p-3">
                  <p className="bx-label mb-2">Original Uploaded Image</p>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`Original ${state.data.original_filename}`}
                      className="max-h-72 w-full rounded-xs border border-border-neutral object-contain bg-surface"
                    />
                  ) : (
                    <EmptyState title="Preview cleared" description="Original preview unavailable." />
                  )}
                </div>

                <div className="flex flex-col justify-between rounded-sm border border-border-neutral bg-sand/40 p-4">
                  <div className="space-y-2">
                    <p className="bx-label">Generated Segmentation Mask Artifact</p>
                    <div className="flex items-start gap-2.5 text-xs text-charcoal">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
                      <p className="leading-relaxed">
                        SegFormer generated a colored mask PNG on the server under reference{' '}
                        <code>{state.data.result_id}</code>. For security (no server filesystem path
                        exposure) and because <code>api.py</code> does not yet include an image-mask
                        download route, mask PNG previews are summarized via detected class pixel
                        distributions below until a media-serving route is added.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xs border border-border-neutral bg-surface p-2.5">
                      <span className="bx-label">Original Size</span>
                      <p className="mt-1 font-mono font-semibold text-editorial-blue">
                        {state.data.dimensions.width}×{state.data.dimensions.height}
                      </p>
                    </div>
                    <div className="rounded-xs border border-border-neutral bg-surface p-2.5">
                      <span className="bx-label">Detected Labels</span>
                      <p className="mt-1 font-mono font-semibold text-editorial-blue">
                        {state.data.detected_classes_count} ADE20K classes
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {state.data.detected_classes.length > 0 && (
                <div className="h-[230px] w-full" aria-label="Detected ADE20K class share bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={state.data.detected_classes.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 20, bottom: 4 }}
                    >
                      <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#292D32', fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="predicted_class_name"
                        width={110}
                        tick={{ fill: '#183153', fontSize: 11, fontWeight: 500 }}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`, 'Pixel Share']}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#DED7CB',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="percentage_of_image_pixels" fill="#183153" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <Table
                caption="SegFormer ADE20K detected classes"
                columns={classColumns}
                data={state.data.detected_classes}
                rowKey={(row) => String(row.predicted_class_id)}
              />

              <div className="flex items-start gap-2 rounded-sm border border-coral/60 bg-ivory/75 p-3 text-xs text-charcoal">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                <p>{state.data.interpretation_note}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
