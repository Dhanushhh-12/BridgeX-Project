import { useId, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  value: string
  onValueChange: (nextValue: string) => void
  onClear?: () => void
}

export function SearchField({
  id,
  label,
  value,
  onValueChange,
  onClear,
  placeholder = 'Search...',
  className,
  onKeyDown,
  ...rest
}: SearchFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  function handleClear() {
    onValueChange('')
    onClear?.()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && value) {
      event.preventDefault()
      handleClear()
    }
    onKeyDown?.(event)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wide text-editorial-blue"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-editorial-blue/70"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'h-10 w-full rounded-sm border border-border-neutral bg-surface pl-9 pr-9 text-sm text-charcoal',
            'placeholder:text-charcoal/50 transition-colors duration-150',
            'hover:border-editorial-blue/50 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-editorial-blue',
            className,
          )}
          {...rest}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search query"
            className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-xs text-editorial-blue/75 hover:bg-sand hover:text-editorial-blue"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
