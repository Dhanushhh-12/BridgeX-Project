import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  UserCircle2,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { findNavItemByPath, NAV_ITEMS } from '../../config/navigation'
import { useAuth } from '../../context/useAuth'
import { cn } from '../../lib/cn'
import { BX_OVERLAY_TRANSITION } from '../../lib/motion'
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
  const { user, logout } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
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
    const allowedNav = NAV_ITEMS.filter(
      (item) => !item.allowedRoles || (user && item.allowedRoles.includes(user.role)),
    )
    const baseEntries = [
      ...allowedNav.map((item) => ({
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
  }, [searchQuery, user])

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
    setMobileSearchOpen(false)
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-neutral bg-surface">
      <div className="flex h-16 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Left: Sidebar toggles + Breadcrumb / Page Context */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border-neutral bg-ivory text-editorial-blue hover:bg-sand lg:hidden"
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
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {/* Mobile Search Drawer Toggle (<640px) */}
          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen((prev) => !prev)
              setNotificationsOpen(false)
              setProfileOpen(false)
            }}
            aria-expanded={mobileSearchOpen}
            aria-label={mobileSearchOpen ? 'Close quick module search' : 'Open quick module search'}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border-neutral bg-ivory/70 text-editorial-blue hover:bg-sand sm:hidden',
              mobileSearchOpen && 'border-editorial-blue bg-sand',
            )}
          >
            {mobileSearchOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Global Module Search (Tablet/Desktop >=640px) */}
          <div ref={searchBoxRef} className="relative hidden sm:block sm:w-56 md:w-64 lg:w-72">
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

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  key="desktop-search-results"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={BX_OVERLAY_TRANSITION}
                  style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                  className="absolute right-0 mt-1.5 w-80 rounded-sm border border-border-neutral bg-surface p-2"
                  role="region"
                  aria-label="Quick module search results"
                >
                  <p className="border-b border-border-neutral px-2 pb-1.5 text-[11px] font-medium text-charcoal/70">
                    Navigation jump (Ctrl/Tab accessible)
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
                            className="flex w-full items-center justify-between rounded-xs px-2.5 py-2 text-left text-xs transition-colors hover:bg-sand/70"
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
                </motion.div>
              )}
            </AnimatePresence>
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
                'inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border-neutral bg-ivory/70 text-editorial-blue transition-colors hover:bg-sand sm:h-9 sm:w-9',
                notificationsOpen && 'border-editorial-blue bg-sand',
              )}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  key="notifications-popover"
                  id="header-notifications-panel"
                  role="region"
                  aria-label="Notifications panel"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={BX_OVERLAY_TRANSITION}
                  style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                  className="fixed inset-x-3 top-[4.25rem] rounded-sm border border-border-neutral bg-surface p-4 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80"
                >
                  <div className="flex items-center justify-between border-b border-border-neutral pb-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-editorial-blue">
                      Notifications
                    </span>
                    <Badge variant="neutral">Live Workspace</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-charcoal/85">
                    No unread alerts. Weather risk and prediction events are logged into SQLite
                    and visible inside Executive Overview and Analytics.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
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
                'inline-flex h-10 items-center gap-1.5 rounded-sm border border-border-neutral bg-ivory/70 px-2.5 text-xs font-medium text-editorial-blue transition-colors hover:bg-sand sm:h-9 sm:gap-2',
                profileOpen && 'border-editorial-blue bg-sand',
              )}
            >
              <UserCircle2 className="h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <span className="hidden sm:inline">{user?.full_name ?? 'Account'}</span>
              {user && (
                <Badge variant="info" className="hidden md:inline-flex">
                  {user.role_label}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-charcoal/70" aria-hidden="true" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  key="profile-popover"
                  id="header-profile-menu"
                  role="menu"
                  aria-label="User profile menu"
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={BX_OVERLAY_TRANSITION}
                  style={{ boxShadow: 'var(--bx-shadow-overlay)' }}
                  className="fixed inset-x-3 top-[4.25rem] rounded-sm border border-border-neutral bg-surface p-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64"
                >
                <div className="border-b border-border-neutral px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-editorial-blue">
                      {user?.full_name ?? 'Signed-in User'}
                    </p>
                    {user && <Badge variant="neutral">{user.role_label}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-charcoal/75">
                    {user ? `@${user.username} · ${user.email}` : 'Session inactive'}
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
                    <span>Profile &amp; Security</span>
                  </button>
                  {user?.role === 'administrator' && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectRoute('/users')}
                      className="flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-xs font-medium text-charcoal hover:bg-sand/70 hover:text-editorial-blue"
                    >
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>User &amp; Role Management</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectRoute('/design-system')}
                    className="flex w-full items-center gap-2 rounded-xs px-2.5 py-2 text-left text-xs font-medium text-charcoal hover:bg-sand/70 hover:text-editorial-blue"
                  >
                    <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Design System Reference</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false)
                      void logout().then(() => navigate('/login', { replace: true }))
                    }}
                    className="mt-1 flex w-full items-center gap-2 border-t border-border-neutral px-2.5 pt-2.5 pb-1.5 text-left text-xs font-semibold text-editorial-blue hover:bg-coral/15"
                  >
                    <LogOut className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            key="mobile-search-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={BX_OVERLAY_TRANSITION}
            className="overflow-hidden border-t border-border-neutral bg-ivory/80 px-3 py-2.5 sm:hidden"
          >
          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Jump to workspace module..."
            aria-label="Search workspace modules on mobile"
            className="h-10 bg-surface text-xs"
          />
          <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto rounded-sm border border-border-neutral bg-surface p-1.5">
            {searchResults.length === 0 ? (
              <li className="px-2 py-2 text-xs text-charcoal/75">
                No modules match &ldquo;{searchQuery}&rdquo;.
              </li>
            ) : (
              searchResults.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectRoute(entry.path)}
                    className="flex w-full items-center justify-between rounded-xs px-2.5 py-2 text-left text-xs hover:bg-sand/70"
                  >
                    <span className="font-semibold text-editorial-blue">{entry.label}</span>
                    <span className="text-[11px] text-charcoal/70">{entry.meta}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
