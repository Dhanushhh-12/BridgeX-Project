import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-charcoal/80">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-xs px-1 py-0.5 font-medium text-editorial-blue hover:bg-sand/70 hover:text-coral-hover"
          >
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>AI Bridge X</span>
          </Link>
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-sage shrink-0" aria-hidden="true" />
              {isLast || !item.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'px-1 py-0.5',
                    isLast ? 'font-semibold text-editorial-blue' : 'text-charcoal/75',
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="rounded-xs px-1 py-0.5 font-medium text-editorial-blue hover:bg-sand/70"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
