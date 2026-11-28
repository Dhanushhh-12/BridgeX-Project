import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { BX_OVERLAY_TRANSITION } from '../../lib/motion'

export interface TabItem {
  id: string
  label: string
  badge?: string | number
  disabled?: boolean
  content: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  activeId?: string
  defaultActiveId?: string
  onTabChange?: (nextId: string) => void
  ariaLabel?: string
  className?: string
}

export function Tabs({
  items,
  activeId,
  defaultActiveId,
  onTabChange,
  ariaLabel = 'Section tabs',
  className,
}: TabsProps) {
  const baseId = useId()
  const [internalId, setInternalId] = useState<string>(
    defaultActiveId ?? items[0]?.id ?? '',
  )
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const currentId = activeId ?? internalId
  const currentTab = items.find((item) => item.id === currentId) ?? items[0]

  function selectTab(nextId: string) {
    if (activeId === undefined) {
      setInternalId(nextId)
    }
    onTabChange?.(nextId)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabledIndices = items
      .map((item, idx) => (item.disabled ? -1 : idx))
      .filter((idx) => idx !== -1)

    if (enabledIndices.length === 0) return

    const pos = enabledIndices.indexOf(index)
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight') {
      nextIndex = enabledIndices[(pos + 1) % enabledIndices.length]
    } else if (event.key === 'ArrowLeft') {
      nextIndex = enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length]
    } else if (event.key === 'Home') {
      nextIndex = enabledIndices[0]
    } else if (event.key === 'End') {
      nextIndex = enabledIndices[enabledIndices.length - 1]
    }

    if (nextIndex !== null) {
      event.preventDefault()
      selectTab(items[nextIndex].id)
      tabRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-nowrap gap-1 overflow-x-auto border-b border-border-neutral sm:flex-wrap"
      >
        {items.map((item, index) => {
          const isSelected = currentTab?.id === item.id
          const tabId = `${baseId}-tab-${item.id}`
          const panelId = `${baseId}-panel-${item.id}`

          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              id={tabId}
              type="button"
              role="tab"
              disabled={item.disabled}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2.5 text-xs transition-colors duration-150 sm:px-4 sm:text-sm',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-editorial-blue',
                'disabled:cursor-not-allowed disabled:opacity-45',
                isSelected
                  ? 'font-semibold text-editorial-blue'
                  : 'font-medium text-charcoal/75 hover:text-editorial-blue',
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="rounded-xs border border-border-neutral bg-sand px-1.5 py-0.5 font-mono text-[11px] font-semibold text-editorial-blue">
                  {item.badge}
                </span>
              )}
              {isSelected && (
                <motion.span
                  layoutId={`${baseId}-active-tab`}
                  transition={BX_OVERLAY_TRANSITION}
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-coral"
                />
              )}
            </button>
          )
        })}
      </div>

      {currentTab && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentTab.id}
            id={`${baseId}-panel-${currentTab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${currentTab.id}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={BX_OVERLAY_TRANSITION}
            className="pt-4 focus-visible:outline-none"
          >
            {currentTab.content}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
