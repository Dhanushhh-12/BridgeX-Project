export interface HealthResponse {
  status: string
  application: string
  version: string
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
  segmentation_status: string
  model_used: string
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

export interface ApiErrorPayload {
  success?: boolean
  error?: string
  message?: string
  detail?: unknown
}
