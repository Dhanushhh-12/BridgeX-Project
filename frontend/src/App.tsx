import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { LoadingIndicator } from './components/ui'
import { NAV_ITEMS } from './config/navigation'

const ExecutiveOverviewPage = lazy(() =>
  import('./pages/ExecutiveOverviewPage').then((m) => ({ default: m.ExecutiveOverviewPage })),
)
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const ProjectDetailsPage = lazy(() =>
  import('./pages/ProjectDetailsPage').then((m) => ({ default: m.ProjectDetailsPage })),
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
    <BrowserRouter>
      <Suspense fallback={<LoadingIndicator label="Loading workspace module..." />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<ExecutiveOverviewPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
            <Route path="/progress" element={<ConstructionProgressPage />} />
            <Route path="/predict" element={<DelayPredictionPage />} />
            <Route path="/weather" element={<WeatherMonitoringPage />} />
            <Route path="/vision" element={<ComputerVisionPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            {NAV_ITEMS.filter(
              (item) =>
                item.path !== '/' &&
                item.path !== '/projects' &&
                item.path !== '/progress' &&
                item.path !== '/predict' &&
                item.path !== '/weather' &&
                item.path !== '/vision' &&
                item.path !== '/assistant',
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
  )
}

export default App
