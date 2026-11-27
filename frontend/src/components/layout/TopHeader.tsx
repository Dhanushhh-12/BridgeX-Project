import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCircle2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { findNavItemByPath, NAV_ITEMS } from '../../config/navigation'
import { cn } from '../../lib/cn'
import { Badge, SearchField } from '../ui'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'

export interface TopHeaderProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileMenu: () => void
}

export function TopHeader({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}: TopHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const searchBoxRef = useRef<HTMLDivElement | null>(null)
  const notifBoxRef = useRef<HTMLDivElement | null>(null)
  const profileBoxRef = useRef<HTMLDivElement | null>(null)

  const currentNav = findNavItemByPath(location.pathname)
  const isDesignSystemRoute = location.pathname === '/design-system'
  const currentTitle = currentNav?.label ?? (isDesignSystemRoute ? 'Design System' : 'Page Not Found')

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
    if (location.pathname === '/') {
      return [{ label: 'Overview' }]
    }
    return [{ label: currentTitle }]
  }, [currentTitle, location.pathname])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const baseEntries = [
      ...NAV_ITEMS.map((item) => ({
        id: item.id,
        label: item.label,
        path: item.path,
        meta: item.sectionGroup,
      })),
      {
        id: 'design-system',
        label: 'Design System Reference',
        path: '/design-system',
        meta: 'Step 14.3 UI Gallery',
      },
    ]
    if (!q) return baseEntries.slice(0, 6)
    return baseEntries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) || entry.meta.toLowerCase().includes(q),
    )
  }, [searchQuery])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) {
        setSearchOpen(false)
      }
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotificationsOpen(false)
      }
      if (profileBoxRef.current && !profileBoxRef.current.contains(target)) {
        setProfileOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function handleSelectRoute(path: string) {
    navigate(path)
    setSearchQuery('')
    setSearchOpen(false)
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-neutral bg-surface">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Sidebar toggles + Breadcrumb / Page Context */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue hover:bg-sand lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleSidebar}
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue hover:bg-sand lg:inline-flex"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <div className="min-w-0">
            <div className="hidden md:block">
              <Breadcrumbs items={breadcrumbs} />
            </div>
            <p className="truncate text-sm font-semibold text-editorial-blue md:text-xs md:font-medium md:text-charcoal/80">
              {currentTitle}
            </p>
          </div>
        </div>

        {/* Right: Quick Navigation Search + Notifications + Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Global Module Search */}
          <div ref={searchBoxRef} className="relative hidden sm:block sm:w-64 lg:w-72">
            <SearchField
              value={searchQuery}
              onValueChange={(val) => {
                setSearchQuery(val)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Jump to module..."
              aria-label="Search workspace modules"
              className="h-9 bg-ivory/60 text-xs"
            />

            {searchOpen && (
              <div
                style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                className="absolute right-0 mt-1.5 w-80 rounded-sm border border-border-neutral bg-surface p-2"
                role="region"
                aria-label="Quick module search results"
              >
                <p className="border-b border-border-neutral px-2 pb-1.5 text-[11px] font-medium text-charcoal/70">
                  Navigation jump (data search connects in Step 14.9+)
                </p>
                {searchResults.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-charcoal/75">
                    No modules match &ldquo;{searchQuery}&rdquo;.
                  </p>
                ) : (
                  <ul className="mt-1 max-h-60 space-y-0.5 overflow-y-auto">
                    {searchResults.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectRoute(entry.path)}
                          className="flex w-full items-center justify-between rounded-xs px-2.5 py-2 text-left text-xs hover:bg-sand/70"
                        >
                          <span className="font-semibold text-editorial-blue">
                            {entry.label}
                          </span>
                          <span className="text-[11px] text-charcoal/70">{entry.meta}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Notification Center Toggle */}
          <div ref={notifBoxRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((prev) => !prev)
                setProfileOpen(false)
              }}
              aria-expanded={notificationsOpen}
              aria-controls="header-notifications-panel"
              aria-label="Toggle notifications panel"
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-neutral bg-ivory/70 text-editorial-blue hover:bg-sand',
                notificationsOpen && 'border-editorial-blue bg-sand',
              )}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>

            {notificationsOpen && (
              <div
                id="header-notifications-panel"
                role="region"
                aria-label="Notifications panel"
                style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-sm border border-border-neutral bg-surface p-4"
              >
                <div className="flex items-center justify-between border-b border-border-neutral pb-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-editorial-blue">
                    Notifications
                  </span>
                  <Badge variant="neutral">Dev Preview</Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-charcoal/85">
                  No active alerts. Weather risk and prediction alerts will stream here once
                  persistence endpoints are connected in upcoming steps.
                </p>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div ref={profileBoxRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev)
                setNotificationsOpen(false)
              }}
              aria-expanded={profileOpen}
              aria-controls="header-profile-menu"
              aria-label="Open workspace user menu"
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-sm border border-border-neutral bg-ivory/70 px-2.5 text-xs font-medium text-editorial-blue hover:bg-sand',
                profileOpen && 'border-editorial-blue bg-sand',
              )}
            >
              <UserCircle2 className="h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <span className="hidden sm:inline">Workspace Preview</span>
              <ChevronDown className="h-3.5 w-3.5 text-charcoal/70" aria-hidden="true" />
            </button>

            {profileOpen && (
              <div
                id="header-profile-menu"
                role="menu"
                aria-label="User profile menu"
                style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                className="absolute right-0 mt-2 w-64 rounded-sm border border-border-neutral bg-surface p-2"
              >
                <div className="border-b border-border-neutral px-2.5 py-2">
                  <p className="text-xs font-semibold text-editorial-blue">
                    Development Operator
                  </p>
                  <p className="text-[11px] text-charcoal/75">
                    Placeholder profile (auth connects in Step 14.7)
                  </p>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectRoute('/settings')}
                    className="flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-xs font-medium text-charcoal hover:bg-sand/70 hover:text-editorial-blue"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Workspace Settings</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectRoute('/design-system')}
                    className="flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-xs font-medium text-charcoal hover:bg-sand/70 hover:text-editorial-blue"
                  >
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Design System Reference</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
