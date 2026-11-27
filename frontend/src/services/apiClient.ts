import type {
  AIChatRequestPayload,
  AIChatResponse,
  AnalyzeImageResponse,
  AnalyzeProgressResponse,
  ApiErrorPayload,
  HealthResponse,
  PredictionRequestPayload,
  PredictionResponse,
  SystemInfoResponse,
  WeatherResponse,
} from '../types/api'
import { frontendEnv } from './env'

export class ApiClientError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

function parseErrorMessage(rawText: string, status: number): string {
  try {
    const parsed = rawText ? (JSON.parse(rawText) as ApiErrorPayload) : {}
    if (typeof parsed.message === 'string') return parsed.message
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch {
    // Non-JSON upstream error body
  }
  return `Backend returned HTTP ${status}`
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${frontendEnv.requestBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })

    const rawText = await response.text()
    const parsed = rawText ? (JSON.parse(rawText) as unknown) : null

    if (!response.ok) {
      throw new ApiClientError(parseErrorMessage(rawText, response.status), response.status)
    }

    return parsed as T
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('Request timed out while contacting the FastAPI backend.')
    }
    throw new ApiClientError(
      'Unable to reach the FastAPI backend. Ensure Uvicorn is running on port 8000.',
    )
  } finally {
    window.clearTimeout(timer)
  }
}

function uploadFormWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
  timeoutMs = 120000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${frontendEnv.requestBaseUrl}${path}`)
    xhr.timeout = timeoutMs
    xhr.setRequestHeader('Accept', 'application/json')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiClientError('Backend returned malformed JSON response.', xhr.status))
        }
      } else {
        reject(new ApiClientError(parseErrorMessage(xhr.responseText, xhr.status), xhr.status))
      }
    }

    xhr.onerror = () => {
      reject(
        new ApiClientError(
          'Network error while uploading image to FastAPI. Ensure Uvicorn is running.',
        ),
      )
    }

    xhr.ontimeout = () => {
      reject(
        new ApiClientError(
          'Computer vision inference timed out. CPU segmentation can take longer on large photos.',
        ),
      )
    }

    xhr.send(formData)
  })
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/health')
}

export function getSystemInfo(): Promise<SystemInfoResponse> {
  return requestJson<SystemInfoResponse>('/system-info')
}

export function getWeather(params: {
  latitude: number
  longitude: number
  days?: number
  thresholdMm?: number
}): Promise<WeatherResponse> {
  const search = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    days: String(params.days ?? 7),
    threshold_mm: String(params.thresholdMm ?? 5.0),
  })
  return requestJson<WeatherResponse>(`/weather?${search.toString()}`, {}, 12000)
}

export function postPredict(payload: PredictionRequestPayload): Promise<PredictionResponse> {
  return requestJson<PredictionResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postAnalyzeImage(
  params: {
    file: File
    projectId?: string
    description?: string
  },
  onProgress?: (percent: number) => void,
): Promise<AnalyzeImageResponse> {
  const form = new FormData()
  form.append('file', params.file)
  if (params.projectId?.trim()) form.append('project_id', params.projectId.trim())
  if (params.description?.trim()) form.append('description', params.description.trim())
  return uploadFormWithProgress<AnalyzeImageResponse>('/analyze-image', form, onProgress)
}

export function postAnalyzeProgress(
  params: {
    previousImage: File
    currentImage: File
    projectId?: string
    taskDescription?: string
  },
  onProgress?: (percent: number) => void,
): Promise<AnalyzeProgressResponse> {
  const form = new FormData()
  form.append('previous_image', params.previousImage)
  form.append('current_image', params.currentImage)
  if (params.projectId?.trim()) form.append('project_id', params.projectId.trim())
  if (params.taskDescription?.trim()) form.append('task_description', params.taskDescription.trim())
  return uploadFormWithProgress<AnalyzeProgressResponse>('/analyze-progress', form, onProgress)
}

export function postAiChat(payload: AIChatRequestPayload): Promise<AIChatResponse> {
  return requestJson<AIChatResponse>(
    '/ai/chat',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    70000,
  )
}
