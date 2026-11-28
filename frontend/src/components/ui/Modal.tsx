import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { BX_OVERLAY_TRANSITION } from '../../lib/motion'

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={BX_OVERLAY_TRANSITION}
          className="fixed inset-0 z-50 flex items-center justify-center bg-editorial-blue/45 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose()
            }
          }}
        >
          <motion.div
            key="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={BX_OVERLAY_TRANSITION}
            style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
            className={cn(
              'flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-sm border border-border-neutral bg-surface text-charcoal',
              SIZE_CLASSES[size],
            )}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border-neutral bg-ivory/75 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
              <div className="min-w-0">
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border border-border-neutral bg-surface text-editorial-blue hover:bg-sand sm:h-8 sm:w-8"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="overflow-y-auto px-4 py-4 text-sm text-charcoal sm:px-6 sm:py-5">
              {children}
            </div>

            {footer && (
              <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-neutral bg-ivory/40 px-4 py-3 sm:px-6 sm:py-3.5">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
