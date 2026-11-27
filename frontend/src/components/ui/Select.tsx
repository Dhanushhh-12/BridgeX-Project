import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
  placeholder?: string
  helperText?: string
  error?: string
}

export function Select({
  id,
  label,
  options,
  placeholder,
  helperText,
  error,
  required,
  className,
  ...rest
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const helperId = helperText ? `${selectId}-helper` : undefined
  const errorId = error ? `${selectId}-error` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
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

      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full appearance-none rounded-sm border bg-surface pl-3 pr-9 text-sm text-charcoal',
            'transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-editorial-blue',
            'disabled:cursor-not-allowed disabled:bg-sand/50 disabled:text-charcoal/60',
            error ? 'border-coral' : 'border-border-neutral hover:border-editorial-blue/50',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-editorial-blue/75"
          aria-hidden="true"
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
