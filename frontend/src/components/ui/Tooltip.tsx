import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TooltipProps {
  content: string
  placement?: 'top' | 'bottom' | 'right'
  disabled?: boolean
  children: ReactNode
  className?: string
}

const PLACEMENT_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
}

export function Tooltip({
  content,
  placement = 'top',
  disabled = false,
  children,
  className,
}: TooltipProps) {
  const tooltipId = useId()
  const [visible, setVisible] = useState(false)

  if (disabled) {
    return <span className={cn('inline-flex items-center', className)}>{children}</span>
  }

  return (
    <span
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? tooltipId : undefined} className="inline-flex w-full items-center">
        {children}
      </span>

      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{ boxShadow: 'var(--bx-shadow-subtle)' }}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-[240px]',
            'rounded-xs border border-editorial-blue bg-editorial-blue px-2.5 py-1.5 text-xs font-medium text-surface',
            PLACEMENT_CLASSES[placement],
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
