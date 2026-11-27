import { useId, useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { validateUploadImageFile } from '../../data/cvMetadata'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { cn } from '../../lib/cn'
import { Badge, Button, ErrorState } from '../ui'

export interface ImageDropzoneProps {
  label: string
  helperText?: string
  file: File | null
  onFileChange: (file: File | null) => void
  disabled?: boolean
}

export function ImageDropzone({
  label,
  helperText = 'JPEG or PNG only, maximum 10 MB.',
  file,
  onFileChange,
  disabled = false,
}: ImageDropzoneProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<'JPEG' | 'PNG' | null>(null)
  const previewUrl = useObjectUrl(file)

  async function processSelectedFile(candidate: File | null) {
    if (!candidate) return
    const check = await validateUploadImageFile(candidate)
    if (!check.valid) {
      setValidationError(check.error ?? 'Invalid image file.')
      setDetectedFormat(null)
      onFileChange(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setValidationError(null)
    setDetectedFormat(check.detectedFormat ?? null)
    onFileChange(candidate)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const dropped = event.dataTransfer.files?.[0] ?? null
    void processSelectedFile(dropped)
  }

  function handleClear() {
    setValidationError(null)
    setDetectedFormat(null)
    onFileChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wide text-editorial-blue"
        >
          {label}
        </label>
        <span className="text-[11px] text-charcoal/70">{helperText}</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-sm border border-dashed p-4 transition-colors duration-150',
          isDragging
            ? 'border-coral bg-sand/70'
            : 'border-border-neutral bg-ivory/50 hover:border-editorial-blue/50',
          disabled && 'opacity-60 pointer-events-none',
        )}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null
            void processSelectedFile(picked)
          }}
        />

        {!file || !previewUrl ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-neutral bg-surface text-editorial-blue">
              <UploadCloud className="h-5 w-5 text-coral" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-editorial-blue">
                Drag and drop site photograph here
              </p>
              <p className="text-xs text-charcoal/75">
                Validated by binary file header (JPEG/PNG, max 10 MB)
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ImagePlus className="h-3.5 w-3.5" />}
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Image
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <img
              src={previewUrl}
              alt={`Preview of ${file.name}`}
              className="h-28 w-full rounded-xs border border-border-neutral object-cover sm:w-40 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate text-sm font-semibold text-editorial-blue">{file.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                {detectedFormat && <Badge variant="info">{detectedFormat}</Badge>}
                <Badge variant="neutral">
                  {(file.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={handleClear}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {validationError && (
        <ErrorState compact title="Upload Validation Rejected" message={validationError} />
      )}
    </div>
  )
}
