import type { ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-10 text-center',
        className,
      )}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue"
        aria-hidden="true"
      >
        {icon ?? <FolderOpen className="h-5 w-5 text-sage" />}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-sm font-semibold text-editorial-blue">{title}</h3>
        <p className="text-xs leading-relaxed text-charcoal/80">{description}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
