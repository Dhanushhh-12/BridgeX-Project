import type {
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AIChatRequestPayload,
  AIChatResponse,
  AnalyzeImageResponse,
  AnalyzeProgressResponse,
  ApiErrorPayload,
  AuthSessionResponse,
  AuthUser,
  BackendProjectDetailResponse,
  BackendTasksResponse,
  CreateProjectPayload,
  HealthResponse,
  LoginPayload,
  ManagedProjectRecord,
  ManagedProjectsResponse,
  PlatformAnalyticsResponse,
  PredictionRequestPayload,
  PredictionResponse,
  RegisterPayload,
  ReportGenerationPayload,
  ReportPreviewResponse,
  ReportsCatalogResponse,
  SystemInfoResponse,
  UpdateProjectPayload,
  UsersListResponse,
  WeatherResponse,
} from '../types/api'
import { frontendEnv } from './env'

let authTokenProvider: () => string | null = () => null
let unauthorizedHandler: ((reason?: string) => void) | null = null

export function configureAuthClient(options: {
  getToken: () => string | null
  onUnauthorized: (reason?: string) => void
}): void {
  authTokenProvider = options.getToken
  unauthorizedHandler = options.onUnauthorized
}

function getAuthHeader(): Record<string, string> {
  const token = authTokenProvider()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function maybeHandleUnauthorized(path: string, status: number, message: string): void {
  if (
    status === 401 &&
    unauthorizedHandler &&
    !path.startsWith('/api/v1/auth/login') &&
    !path.startsWith('/api/v1/auth/register')
  ) {
    unauthorizedHandler(message)
  }
}

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
        ...getAuthHeader(),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })

    const rawText = await response.text()

    if (!response.ok) {
      const msg = parseErrorMessage(rawText, response.status)
      maybeHandleUnauthorized(path, response.status, msg)
      throw new ApiClientError(msg, response.status)
    }

    if (!rawText.trim()) {
      return null as T
    }

    try {
      return JSON.parse(rawText) as T
    } catch {
      throw new ApiClientError('Backend returned malformed JSON response.', response.status)
    }
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
    const token = authTokenProvider()
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!xhr.responseText.trim()) {
          resolve(null as T)
          return
        }
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiClientError('Backend returned malformed JSON response.', xhr.status))
        }
      } else {
        const msg = parseErrorMessage(xhr.responseText, xhr.status)
        maybeHandleUnauthorized(path, xhr.status, msg)
        reject(new ApiClientError(msg, xhr.status))
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

export function getReportsCatalog(): Promise<ReportsCatalogResponse> {
  return requestJson<ReportsCatalogResponse>('/api/v1/reports/catalog')
}

export function postReportPreview(
  payload: ReportGenerationPayload,
): Promise<ReportPreviewResponse> {
  return requestJson<ReportPreviewResponse>(
    '/api/v1/reports/preview',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    30000,
  )
}

export async function downloadReportExport(
  format: 'pdf' | 'csv',
  payload: ReportGenerationPayload,
): Promise<{ filename: string; sizeBytes: number }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 45000)

  try {
    const exportPath = `/api/v1/reports/export/${format}`
    const response = await fetch(`${frontendEnv.requestBaseUrl}${exportPath}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errText = await response.text()
      const msg = parseErrorMessage(errText, response.status)
      maybeHandleUnauthorized(exportPath, response.status, msg)
      throw new ApiClientError(msg, response.status)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="([^"]+)"/)
    const fallbackName = `bridgex_${payload.report_type}_${payload.project_id}.${format}`
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '_')
    const filename = match?.[1] || fallbackName

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return { filename, sizeBytes: blob.size }
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('Export timed out while generating report.')
    }
    throw new ApiClientError('Unable to reach FastAPI report export service.')
  } finally {
    window.clearTimeout(timer)
  }
}

export function postLogin(payload: LoginPayload): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postRegister(payload: RegisterPayload): Promise<AuthSessionResponse> {
  return requestJson<AuthSessionResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function postLogout(): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>('/api/v1/auth/logout', {
    method: 'POST',
  })
}

export function getCurrentProfile(): Promise<{ status: string; user: AuthUser }> {
  return requestJson<{ status: string; user: AuthUser }>('/api/v1/auth/me')
}

export function getManagedUsers(): Promise<UsersListResponse> {
  return requestJson<UsersListResponse>('/api/v1/users')
}

export function postManagedUser(
  payload: AdminCreateUserPayload,
): Promise<{ status: string; user: AuthUser }> {
  return requestJson<{ status: string; user: AuthUser }>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchManagedUser(
  userId: number,
  payload: AdminUpdateUserPayload,
): Promise<{ status: string; user: AuthUser }> {
  return requestJson<{ status: string; user: AuthUser }>(`/api/v1/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteManagedUser(
  userId: number,
): Promise<{ status: string; deleted_user_id: number }> {
  return requestJson<{ status: string; deleted_user_id: number }>(`/api/v1/users/${userId}`, {
    method: 'DELETE',
  })
}

export function getBackendProjects(): Promise<ManagedProjectsResponse> {
  return requestJson<ManagedProjectsResponse>('/api/v1/projects')
}

export function postCreateProject(
  payload: CreateProjectPayload,
): Promise<{ status: string; project: ManagedProjectRecord }> {
  return requestJson<{ status: string; project: ManagedProjectRecord }>('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchUpdateProject(
  projectCode: string,
  payload: UpdateProjectPayload,
): Promise<{ status: string; project: ManagedProjectRecord }> {
  return requestJson<{ status: string; project: ManagedProjectRecord }>(
    `/api/v1/projects/${encodeURIComponent(projectCode)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export function deleteProjectRecord(
  projectCode: string,
): Promise<{ status: string; deleted_project_code: string }> {
  return requestJson<{ status: string; deleted_project_code: string }>(
    `/api/v1/projects/${encodeURIComponent(projectCode)}`,
    {
      method: 'DELETE',
    },
  )
}

export function getBackendProjectDetail(projectCode: string): Promise<BackendProjectDetailResponse> {
  return requestJson<BackendProjectDetailResponse>(
    `/api/v1/projects/${encodeURIComponent(projectCode)}`,
  )
}

export function getBackendTasks(limit = 50, offset = 0): Promise<BackendTasksResponse> {
  return requestJson<BackendTasksResponse>(`/api/v1/tasks?limit=${limit}&offset=${offset}`)
}

export function patchBackendTask(
  taskCode: string,
  payload: {
    status?: 'Completed' | 'In Progress' | 'Pending' | 'Delayed'
    actual_progress_pct?: number
    actual_duration_days?: number
  },
): Promise<{ status: string; task: BackendTasksResponse['tasks'][number] }> {
  return requestJson(`/api/v1/tasks/${encodeURIComponent(taskCode)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getPlatformAnalytics(): Promise<PlatformAnalyticsResponse> {
  return requestJson<PlatformAnalyticsResponse>('/api/v1/analytics')
}
