import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface LoadingIndicatorProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  inline?: boolean
  className?: string
}

const SPINNER_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

export function LoadingIndicator({
  label = 'Loading data...',
  size = 'md',
  inline = false,
  className,
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        inline
          ? 'inline-flex items-center gap-2 text-sm text-editorial-blue'
          : 'flex flex-col items-center justify-center gap-2.5 py-8 text-center text-sm text-editorial-blue',
        className,
      )}
    >
      <Loader2
        className={cn('animate-spin text-coral shrink-0', SPINNER_SIZES[size])}
        aria-hidden="true"
      />
      <span className="font-medium text-charcoal/85">{label}</span>
    </div>
  )
}

export interface SkeletonBlockProps {
  className?: string
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xs bg-sand', className)}
    />
  )
}
