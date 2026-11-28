import { MotionConfig } from 'motion/react'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout'
import { LoadingIndicator } from './components/ui'
import { NAV_ITEMS } from './config/navigation'
import { AuthProvider } from './context/AuthContext'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const UserManagementPage = lazy(() =>
  import('./pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

const ExecutiveOverviewPage = lazy(() =>
  import('./pages/ExecutiveOverviewPage').then((m) => ({ default: m.ExecutiveOverviewPage })),
)
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const ProjectDetailsPage = lazy(() =>
  import('./pages/ProjectDetailsPage').then((m) => ({ default: m.ProjectDetailsPage })),
)
const ProjectMapsPage = lazy(() =>
  import('./pages/ProjectMapsPage').then((m) => ({ default: m.ProjectMapsPage })),
)
const ThreeVisualizationPage = lazy(() =>
  import('./pages/ThreeVisualizationPage').then((m) => ({ default: m.ThreeVisualizationPage })),
)
const ConstructionProgressPage = lazy(() =>
  import('./pages/ConstructionProgressPage').then((m) => ({
    default: m.ConstructionProgressPage,
  })),
)
const DelayPredictionPage = lazy(() =>
  import('./pages/DelayPredictionPage').then((m) => ({ default: m.DelayPredictionPage })),
)
const WeatherMonitoringPage = lazy(() =>
  import('./pages/WeatherMonitoringPage').then((m) => ({ default: m.WeatherMonitoringPage })),
)
const ComputerVisionPage = lazy(() =>
  import('./pages/ComputerVisionPage').then((m) => ({ default: m.ComputerVisionPage })),
)
const AssistantPage = lazy(() =>
  import('./pages/AssistantPage').then((m) => ({ default: m.AssistantPage })),
)
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const ModulePlaceholderPage = lazy(() =>
  import('./pages/ModulePlaceholderPage').then((m) => ({ default: m.ModulePlaceholderPage })),
)
const DesignSystemPage = lazy(() =>
  import('./pages/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })),
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingIndicator label="Loading workspace module..." />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<ExecutiveOverviewPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
              <Route path="/maps" element={<ProjectMapsPage />} />
              <Route path="/3d-twin" element={<ThreeVisualizationPage />} />
              <Route path="/progress" element={<ConstructionProgressPage />} />
              <Route path="/predict" element={<DelayPredictionPage />} />
              <Route path="/weather" element={<WeatherMonitoringPage />} />
              <Route path="/vision" element={<ComputerVisionPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['administrator']}>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              {NAV_ITEMS.filter(
                (item) =>
                  item.path !== '/' &&
                  item.path !== '/projects' &&
                  item.path !== '/maps' &&
                  item.path !== '/3d-twin' &&
                  item.path !== '/progress' &&
                  item.path !== '/predict' &&
                  item.path !== '/weather' &&
                  item.path !== '/vision' &&
                  item.path !== '/assistant' &&
                  item.path !== '/analytics' &&
                  item.path !== '/reports' &&
                  item.path !== '/users' &&
                  item.path !== '/settings',
              ).map((item) => (
                <Route
                  key={item.id}
                  path={item.path}
                  element={<ModulePlaceholderPage item={item} />}
                />
              ))}
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </MotionConfig>
  )
}

export default App
