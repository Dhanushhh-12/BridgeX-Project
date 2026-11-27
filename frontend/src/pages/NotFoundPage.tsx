import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { Button, Card, CardContent, EmptyState } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Navigation"
        title="Page Not Found"
        description="The requested route does not match an AI Bridge X module."
        breadcrumbs={[{ label: 'Not Found' }]}
      />

      <Card>
        <CardContent className="pt-0">
          <EmptyState
            title="Unknown Workspace Route"
            description="Return to the Overview workspace or pick a valid module from the sidebar."
            action={
              <Link to="/">
                <Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Return to Overview
                </Button>
              </Link>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
