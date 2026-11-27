import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bot,
  Camera,
  Clock,
  CloudRain,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from 'lucide-react'

export interface NavItemConfig {
  id: string
  label: string
  path: string
  icon: LucideIcon
  sectionGroup: 'Core Workspace' | 'Intelligence Engines' | 'Governance'
  subtitle: string
  backendBinding: string
  plannedStep: string
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    sectionGroup: 'Core Workspace',
    subtitle: 'Executive operational summary across ML predictions, weather, CV, and reports.',
    backendBinding: 'GET /health, GET /system-info & aggregated task/report metrics',
    plannedStep: 'Step 14.8',
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    icon: FolderKanban,
    sectionGroup: 'Core Workspace',
    subtitle: 'Infrastructure corridor registry, contractor allocation, and site coordinates.',
    backendBinding: 'Project management API & database layer (planned in upcoming backend steps)',
    plannedStep: 'Step 14.9',
  },
  {
    id: 'progress',
    label: 'Construction Progress',
    path: '/progress',
    icon: TrendingUp,
    sectionGroup: 'Core Workspace',
    subtitle: 'Task schedule tracking across the 6,000-record dataset and active inspections.',
    backendBinding: 'Paginated construction tasks API backed by construction_tasks.csv',
    plannedStep: 'Step 14.9',
  },
  {
    id: 'predict',
    label: 'Delay Prediction',
    path: '/predict',
    icon: Clock,
    sectionGroup: 'Intelligence Engines',
    subtitle: 'XGBoost actual_duration estimator (in days) across 7 task & complexity inputs.',
    backendBinding: 'POST /predict (models/delay_predictor.pkl)',
    plannedStep: 'Step 14.10',
  },
  {
    id: 'weather',
    label: 'Weather Monitoring',
    path: '/weather',
    icon: CloudRain,
    sectionGroup: 'Intelligence Engines',
    subtitle: 'Live 1–16 day Open-Meteo daily precipitation forecasts and rainy-day alerts.',
    backendBinding: 'GET /weather (weather.py)',
    plannedStep: 'Step 14.11',
  },
  {
    id: 'vision',
    label: 'Computer Vision',
    path: '/vision',
    icon: Camera,
    sectionGroup: 'Intelligence Engines',
    subtitle: 'SegFormer ADE20K site segmentation and two-photo visual difference inspection.',
    backendBinding: 'POST /analyze-image & POST /analyze-progress',
    plannedStep: 'Step 14.12',
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    path: '/assistant',
    icon: Bot,
    sectionGroup: 'Intelligence Engines',
    subtitle: 'Local Ollama (qwen2.5:0.5b) assistant grounded in verified local project state.',
    backendBinding: 'POST /ai/chat (assistant_service.py)',
    plannedStep: 'Step 14.13',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    sectionGroup: 'Governance',
    subtitle: 'Contractor performance breakdown, dataset EDA distributions, and SHAP explainability.',
    backendBinding: 'Analytics API & pre-generated SHAP plots in plots/',
    plannedStep: 'Step 14.14',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: FileText,
    sectionGroup: 'Governance',
    subtitle: 'Archive of generated CSV and visual HTML progress inspection reports.',
    backendBinding: 'Reports listing & safe download routes from data/images/reports/',
    plannedStep: 'Step 14.14',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    sectionGroup: 'Governance',
    subtitle: 'Workspace preferences, reduced-motion toggles, and local backend status.',
    backendBinding: 'GET /system-info & authentication/profile settings',
    plannedStep: 'Step 14.7',
  },
]

export function findNavItemByPath(pathname: string): NavItemConfig | undefined {
  if (pathname === '/') {
    return NAV_ITEMS[0]
  }
  return NAV_ITEMS.find(
    (item) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  )
}
