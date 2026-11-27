import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ErrorStateProps {
  title?: string
  message: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function ErrorState({
  title = 'Unable to complete request',
  message,
  action,
  compact = false,
  className,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-sm border border-coral bg-ivory px-4 py-3 text-sm',
          className,
        )}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <div>
            <p className="font-semibold text-editorial-blue">{title}</p>
            <p className="text-xs text-charcoal/85">{message}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-sm border border-coral bg-ivory/75 px-6 py-8 text-center',
        className,
      )}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-sm border border-coral bg-surface text-coral"
        aria-hidden="true"
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-sm font-semibold text-editorial-blue">{title}</h3>
        <p className="text-xs leading-relaxed text-charcoal/85">{message}</p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}
