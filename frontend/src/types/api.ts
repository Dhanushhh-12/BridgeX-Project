export interface HealthResponse {
  status: string
  application: string
  version: string
  database?: string
}

export interface SystemInfoResponse {
  application_name: string
  version: string
  backend_status: string
}

export interface PredictionRequestPayload {
  task_type: string
  contractor: string
  planned_duration: number
  crew_size: number
  material_cost: number
  weather_risk: number
  complexity_level: number
}

export interface PredictionResponse {
  status: string
  target: string
  predicted_value: number
  units: string
}

export interface DailyRainfallPoint {
  date: string
  rainfall_mm: number
  is_rainy: boolean
}

export interface WeatherResponse {
  status: string
  source: string
  record_kind?: string
  latitude: number
  longitude: number
  forecast_days: number
  rain_threshold_mm: number
  rainy_days_count: number
  total_rainfall_mm: number
  units: string
  daily_forecast: DailyRainfallPoint[]
}

export interface DetectedClassRow {
  image_filename: string
  predicted_class_id: number
  predicted_class_name: string
  pixel_count: number
  percentage_of_image_pixels: number
}

export interface AnalyzeImageResponse {
  upload_status: string
  result_id: string
  original_filename: string
  project_id: string | null
  description: string | null
  image_format: string
  file_size_bytes: number
  dimensions: { width: number; height: number }
  analyzed_dimensions: { width: number; height: number }
  saved_upload_path?: string
  segmentation_status: string
  model_used: string
  saved_mask_path?: string
  detected_classes_count: number
  detected_classes: DetectedClassRow[]
  interpretation_note: string
}

export interface ClassShiftRow {
  class_id: number
  class_name: string
  pixels_1: number
  pct_1: number
  pixels_2: number
  pct_2: number
  diff_pct: number
}

export interface AnalyzeProgressResponse {
  analysis_status: string
  result_id: string
  project_id: string | null
  task_description: string | null
  previous_image: {
    original_filename: string
    format: string
    file_size_bytes: number
    original_dimensions: { width: number; height: number }
  }
  current_image: {
    original_filename: string
    format: string
    file_size_bytes: number
    original_dimensions: { width: number; height: number }
  }
  matched_dimensions: { width: number; height: number }
  ai_visual_observations: {
    segmentation_model: string
    image_difference_score_pct: number
    raw_changed_pixels_pct: number
    semantic_region_change_pct: number
    detected_classes_count: number
    top_visible_class_shifts: ClassShiftRow[]
  }
  generated_reports?: {
    csv_report_path: string
    html_report_path: string
    visual_assets_dir: string
  }
  engineer_verification: {
    verified_completion_pct: number | null
    verification_status: string
  }
  limitations: string
}

export interface AIChatRequestPayload {
  message: string
}

export interface AIChatResponse {
  success: boolean
  response: string
}

export interface ReportCatalogItem {
  report_type: string
  title: string
  description: string
  available: boolean
  unavailable_reason: string | null
  data_source: string
  supports_chart: boolean
}

export interface ReportProjectRef {
  project_id: string
  name: string
  location: string
  latitude: number
  longitude: number
  is_demo_reference: boolean
}

export interface ReportsCatalogResponse {
  reports: ReportCatalogItem[]
  projects: ReportProjectRef[]
  task_types: string[]
  contractors: string[]
}

export interface ReportGenerationPayload {
  report_type: string
  project_id: string
  days?: number
  threshold_mm?: number
  task_type?: string | null
  contractor?: string | null
  max_rows?: number
}

export interface ReportChartPayload {
  title: string
  labels: string[]
  series: Array<{ name: string; values: number[] }>
}

export interface ReportPreviewResponse {
  status: string
  report_type: string
  title: string
  data_source: string
  generated_at: string
  project_reference: {
    project_id: string
    name: string
    location: string
    is_demo_reference: boolean
  }
  executive_summary: string
  metrics: Array<{ label: string; value: string }>
  chart: ReportChartPayload | null
  columns: string[]
  rows: string[][]
  limitations: string
}

export interface ApiErrorPayload {
  success?: boolean
  error?: string
  message?: string
  detail?: unknown
}

export type UserRole = 'administrator' | 'project_manager' | 'viewer'

export interface UserPermissions {
  can_manage_users: boolean
  can_create_projects: boolean
  can_edit_projects: boolean
  can_delete_projects: boolean
  can_access_analytics: boolean
  can_run_predictions: boolean
  can_export_reports: boolean
}

export interface AuthUser {
  id: number
  username: string
  email: string
  full_name: string
  role: UserRole
  role_label: string
  is_active: boolean
  assigned_projects: string[]
  permissions: UserPermissions
  created_at: string
  updated_at: string
}

export interface AuthSessionResponse {
  status: string
  access_token: string
  token_type: string
  expires_at: string
  user: AuthUser
}

export interface RegisterPayload {
  username: string
  email: string
  full_name: string
  password: string
}

export interface LoginPayload {
  identifier: string
  password: string
}

export interface UsersListResponse {
  status: string
  count: number
  users: AuthUser[]
  requested_by: string
}

export interface AdminCreateUserPayload {
  username: string
  email: string
  full_name: string
  password: string
  role: UserRole
  assigned_projects: string[]
  is_active: boolean
}

export interface AdminUpdateUserPayload {
  role?: UserRole
  is_active?: boolean
  assigned_projects?: string[]
}

export interface ManagedProjectRecord {
  id: number
  project_code: string
  name: string
  project_type: string
  location: string
  corridor: string
  status: 'Active' | 'At Risk' | 'Completed'
  planned_progress_pct: number
  actual_progress_pct: number
  latitude: number | null
  longitude: number | null
  start_date: string
  expected_completion: string
  description: string
  is_demo_reference: boolean
  notes: string
  task_count?: number | null
  updated_at: string
}

export interface ManagedProjectsResponse {
  status: string
  role: UserRole
  scoped_to_assigned: boolean
  total?: number
  count: number
  limit?: number
  offset?: number
  projects: ManagedProjectRecord[]
}

export interface BackendTaskRecord {
  id: number
  task_code: string
  project_code: string
  project_name: string
  task_name: string
  category: string
  contractor: string
  planned_duration_days: number
  actual_duration_days: number | null
  planned_progress_pct: number
  actual_progress_pct: number
  status: 'Completed' | 'In Progress' | 'Pending' | 'Delayed'
  crew_size: number
  material_cost: number
  weather_risk: number
  complexity_level: number
  reporting_period: '7d' | '14d' | '30d'
  is_demo_reference: boolean
  updated_at: string
}

export interface BackendTasksResponse {
  status: string
  role: UserRole
  scoped_to_assigned: boolean
  total: number
  count: number
  tasks: BackendTaskRecord[]
}

export interface BackendProjectDetailResponse {
  status: string
  project: ManagedProjectRecord
  tasks: BackendTaskRecord[]
}

export interface AuditLogRecord {
  id: number
  actor_username: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string
  details: string
  created_at: string
}

export interface PlatformAnalyticsResponse {
  status: string
  role: UserRole
  scoped_to_assigned: boolean
  database_counts: {
    projects: number
    active_projects: number
    at_risk_projects: number
    completed_projects: number
    average_project_progress_pct: number | null
    tasks: number
    completed_tasks: number
    in_progress_tasks: number
    delayed_tasks: number
    ml_predictions_logged: number
    weather_forecasts_logged: number
    cv_analyses_logged: number
    reports_generated: number
  }
  accessible_project_codes: string[]
  recent_predictions: Array<{
    id: number
    project_code: string | null
    task_type: string
    contractor: string
    planned_duration: number
    predicted_duration_days: number
    created_at: string
  }>
  recent_cv_analyses: Array<{
    result_id: string
    analysis_kind: string
    project_code: string | null
    image_diff_score_pct: number | null
    semantic_change_pct: number | null
    verification_status: string
    created_at: string
  }>
  recent_audit_logs: AuditLogRecord[]
  csv_dataset: {
    total_csv_rows: number
    contractors: Array<{
      contractor: string
      task_count: number
      mean_planned_days: number
      mean_actual_days: number
      mean_overrun_days: number
      mean_material_cost: number
    }>
    stages: Array<{
      stage: string
      record_count: number
      mean_planned_days: number
      mean_actual_days: number
    }>
  }
}

export interface CreateProjectPayload {
  project_code: string
  name: string
  project_type: string
  location: string
  corridor: string
  status: 'Active' | 'At Risk' | 'Completed'
  planned_progress_pct: number
  actual_progress_pct: number
  latitude?: number | null
  longitude?: number | null
  start_date?: string
  expected_completion?: string
  description?: string
  notes: string
}

export interface UpdateProjectPayload {
  status?: 'Active' | 'At Risk' | 'Completed'
  planned_progress_pct?: number
  actual_progress_pct?: number
  latitude?: number | null
  longitude?: number | null
  notes?: string
}
