import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, type NavItemConfig } from '../../config/navigation'
import { useAuth } from '../../context/useAuth'
import { cn } from '../../lib/cn'
import { BX_EASE, BX_OVERLAY_TRANSITION } from '../../lib/motion'
import { Tooltip } from '../ui'
import { BrandLogo } from './BrandLogo'

export interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

const GROUPS: Array<NavItemConfig['sectionGroup']> = [
  'Core Workspace',
  'Intelligence Engines',
  'Governance',
]

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user } = useAuth()

  useEffect(() => {
    if (!isMobileOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseMobile()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [isMobileOpen, onCloseMobile])

  function renderNavContent(mobileMode: boolean) {
    const collapsedView = !mobileMode && isCollapsed

    return (
      <div className="flex h-full flex-col bg-editorial-blue text-surface">
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-surface/15 px-4',
            collapsedView ? 'justify-center' : 'justify-between',
          )}
        >
          <NavLink
            to="/"
            onClick={mobileMode ? onCloseMobile : undefined}
            className="rounded-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            aria-label="AI Bridge X Overview"
          >
            <BrandLogo collapsed={collapsedView} />
          </NavLink>

          {mobileMode && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-surface/20 text-surface hover:bg-surface/10"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          aria-label={mobileMode ? 'Mobile primary navigation' : 'Primary navigation'}
          className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4"
        >
          {GROUPS.map((group) => {
            const items = NAV_ITEMS.filter(
              (item) =>
                item.sectionGroup === group &&
                (!item.allowedRoles || (user && item.allowedRoles.includes(user.role))),
            )
            if (items.length === 0) return null
            return (
              <div key={group} className="space-y-1">
                {!collapsedView && (
                  <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sand/70">
                    {group}
                  </p>
                )}
                {collapsedView && (
                  <div className="mx-2 my-1.5 border-t border-surface/10" aria-hidden="true" />
                )}

                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    const linkNode = (
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        onClick={mobileMode ? onCloseMobile : undefined}
                        aria-label={collapsedView ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-sm px-2.5 py-2 text-sm transition-colors duration-150',
                            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral',
                            collapsedView && 'justify-center px-0',
                            isActive
                              ? 'bg-surface/12 font-semibold text-surface'
                              : 'font-medium text-sand/85 hover:bg-surface/8 hover:text-surface',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId={
                                  mobileMode ? 'bx-sidebar-active-mobile' : 'bx-sidebar-active-desktop'
                                }
                                transition={{ duration: 0.22, ease: BX_EASE }}
                                className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-xs bg-coral"
                                aria-hidden="true"
                              />
                            )}
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105',
                                isActive ? 'text-coral' : 'text-sand/80 group-hover:text-surface',
                              )}
                              aria-hidden="true"
                            />
                            {!collapsedView && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </>
                        )}
                      </NavLink>
                    )

                    return (
                      <li key={item.id}>
                        {collapsedView ? (
                          <Tooltip content={item.label} placement="right" className="w-full">
                            {linkNode}
                          </Tooltip>
                        ) : (
                          linkNode
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* Footer Collapse Control (Desktop only) */}
        {!mobileMode && (
          <div className="border-t border-surface/15 p-2.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm border border-surface/15 px-2.5 py-2 text-xs font-medium text-sand/90',
                'transition-colors duration-150 hover:bg-surface/10 hover:text-surface',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral',
                collapsedView && 'justify-center px-0',
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Rail */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: BX_EASE }}
        className="hidden lg:block shrink-0 border-r border-editorial-blue overflow-x-hidden"
      >
        <div className="sticky top-0 h-screen">{renderNavContent(false)}</div>
      </motion.aside>

      {/* Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation drawer"
          >
            <motion.div
              key="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={BX_OVERLAY_TRANSITION}
              className="fixed inset-0 bg-editorial-blue/50"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              key="mobile-drawer-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: BX_EASE }}
              className="relative z-10 h-full w-72 max-w-[85vw] border-r border-editorial-blue"
            >
              {renderNavContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
