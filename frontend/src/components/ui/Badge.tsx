import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'critical'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  showDot?: boolean
  children: ReactNode
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-sand text-charcoal border-border-neutral',
  info: 'bg-editorial-blue text-surface border-editorial-blue',
  success: 'bg-ivory text-editorial-blue border-sage',
  warning: 'bg-sand text-editorial-blue border-coral/70',
  critical: 'bg-coral text-editorial-blue border-coral',
}

const DOT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-charcoal/70',
  info: 'bg-surface',
  success: 'bg-sage',
  warning: 'bg-coral',
  critical: 'bg-editorial-blue',
}

export function Badge({
  variant = 'neutral',
  showDot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-xs font-semibold tracking-wide',
        BADGE_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {showDot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full shrink-0', DOT_CLASSES[variant])}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  )
}
