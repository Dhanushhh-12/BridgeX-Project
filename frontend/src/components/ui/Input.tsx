import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftAddon?: ReactNode
}

export function Input({
  id,
  label,
  helperText,
  error,
  leftAddon,
  required,
  className,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = helperText ? `${inputId}-helper` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wide text-editorial-blue"
        >
          {label}
          {required && (
            <span className="ml-1 text-coral" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {leftAddon && (
          <span
            className="pointer-events-none absolute left-3 flex items-center text-editorial-blue/70"
            aria-hidden="true"
          >
            {leftAddon}
          </span>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-sm border bg-surface px-3 text-sm text-charcoal placeholder:text-charcoal/50',
            'transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-editorial-blue',
            'disabled:cursor-not-allowed disabled:bg-sand/50 disabled:text-charcoal/60',
            Boolean(leftAddon) && 'pl-9',
            error ? 'border-coral' : 'border-border-neutral hover:border-editorial-blue/50',
            className,
          )}
          {...rest}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-editorial-blue border-l-2 border-coral pl-2">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="text-xs text-charcoal/75">
          {helperText}
        </p>
      )}
    </div>
  )
}
