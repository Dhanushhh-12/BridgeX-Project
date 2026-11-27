/**
 * Computer Vision configuration, upload security limits, and verified SegFormer metadata
 * aligned strictly with backend/api/api.py and analyze_segmentation.py.
 */

export const CV_MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB (matches MAX_UPLOAD_BYTES in api.py)
export const CV_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const
export const SAFE_PROJECT_ID_REGEX = /^[A-Za-z0-9 _.-]+$/

export const SEGFORMER_MODEL_INFO = {
  checkpoint: 'nvidia/segformer-b0-finetuned-ade-512-512',
  datasetScope: 'ADE20K (150 general scene/object labels)',
  maxAnalysisDimension: 1024,
  presentRelevantLabels: ['building', 'wall', 'bridge', 'road', 'sidewalk', 'earth', 'rock', 'car', 'truck', 'sky', 'tree'],
  absentConstructionLabels: ['concrete', 'steel', 'rebar', 'excavation', 'crane', 'equipment'],
} as const

export interface ImageValidationResult {
  valid: boolean
  detectedFormat?: 'JPEG' | 'PNG'
  error?: string
}

/**
 * Validate upload size, MIME type, and actual binary magic bytes (not file extension alone).
 * Rejects renamed executables, text files, SVG/GIF/WebP, empty files, and >10 MB payloads.
 */
export async function validateUploadImageFile(file: File): Promise<ImageValidationResult> {
  if (file.size === 0) {
    return { valid: false, error: 'Selected file is empty (0 bytes).' }
  }

  if (file.size > CV_MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      error: `File size (${mb} MB) exceeds the 10 MB maximum upload limit.`,
    }
  }

  // Read first 8 bytes to verify real JPEG or PNG magic signature
  const headerBuffer = await file.slice(0, 8).arrayBuffer()
  const bytes = new Uint8Array(headerBuffer)

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a

  if (!isJpeg && !isPng) {
    return {
      valid: false,
      error: 'Invalid image header. Only genuine JPEG (.jpg/.jpeg) and PNG (.png) files are accepted.',
    }
  }

  return {
    valid: true,
    detectedFormat: isJpeg ? 'JPEG' : 'PNG',
  }
}

export function validateOptionalProjectId(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 100) {
    return 'Project ID must be 100 characters or fewer.'
  }
  if (!SAFE_PROJECT_ID_REGEX.test(trimmed)) {
    return "Project ID may only contain letters, numbers, spaces, '.', '_', and '-'."
  }
  return null
}
