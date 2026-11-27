import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
}

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
}: ModalProps) {
  const titleId = useId()
  const descId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-editorial-blue/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
        className={cn(
          'w-full rounded-sm border border-border-neutral bg-surface text-charcoal',
          SIZE_CLASSES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-neutral bg-ivory/75 px-6 py-4">
          <div>
            <h2 id={titleId} className="bx-heading-card">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs text-charcoal/80">
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal dialog"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xs border border-border-neutral bg-surface text-editorial-blue hover:bg-sand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="px-6 py-5 text-sm text-charcoal">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border-neutral bg-ivory/40 px-6 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
