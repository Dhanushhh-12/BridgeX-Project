import { cn } from '../../lib/cn'

export interface BrandLogoProps {
  collapsed?: boolean
  className?: string
}

export function BrandLogo({ collapsed = false, className }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-coral/80 bg-coral text-editorial-blue"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Minimal architectural bridge arch + deck lines */}
          <path d="M2 16h20" />
          <path d="M5 16v-4c0-3.5 3.1-6 7-6s7 2.5 7 6v4" />
          <path d="M8.5 16v-5" />
          <path d="M12 16V6" />
          <path d="M15.5 16v-5" />
        </svg>
      </div>

      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight text-surface">
            AI Bridge X
          </div>
          <div className="truncate text-[11px] font-medium tracking-wide text-sand/85">
            Infrastructure Platform
          </div>
        </div>
      )}
    </div>
  )
}
