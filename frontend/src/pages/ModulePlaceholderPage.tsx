import { ArrowRight, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui'
import type { NavItemConfig } from '../config/navigation'

export interface ModulePlaceholderPageProps {
  item: NavItemConfig
}

export function ModulePlaceholderPage({ item }: ModulePlaceholderPageProps) {
  const Icon = item.icon

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={item.sectionGroup}
        title={item.label}
        description={item.subtitle}
        breadcrumbs={item.path === '/' ? [{ label: 'Overview' }] : [{ label: item.label }]}
        actions={
          <Link to="/design-system">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Design System Reference
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Module Shell Ready</CardTitle>
              <CardDescription>
                Navigation, breadcrumbs, and page frame are wired for this route.
              </CardDescription>
            </div>
          </div>
          <Badge variant="warning" showDot>
            Scheduled: {item.plannedStep}
          </Badge>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4">
            <p className="bx-label">Route Path</p>
            <p className="mt-1.5 font-mono text-sm font-medium text-editorial-blue">
              {item.path}
            </p>
          </div>

          <div className="rounded-sm border border-border-neutral bg-ivory/60 p-4">
            <p className="bx-label">Planned Backend Connection</p>
            <p className="mt-1.5 font-mono text-xs text-charcoal">{item.backendBinding}</p>
          </div>
        </CardContent>
      </Card>

      <Card variant="sand">
        <CardContent className="flex items-start gap-3 pt-0">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-charcoal">
            Per Step 14.4 scope, no fake project metrics or mock predictions are shown here. Real
            FastAPI endpoints, database views, charts, and interactive forms connect progressively
            starting in Steps 14.5+.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
