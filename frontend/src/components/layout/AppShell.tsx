import { cloneElement, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'
import { BX_PAGE_TRANSITION } from '../../lib/motion'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

export function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const currentOutlet = useOutlet()

  return (
    <div className="flex min-h-screen bg-ivory text-charcoal">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:border focus:border-editorial-blue focus:bg-coral focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-editorial-blue"
      >
        Skip to main content
      </a>

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 focus:outline-none"
        >
          <div className="mx-auto w-full min-w-0 max-w-[1320px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={BX_PAGE_TRANSITION}
              >
                {currentOutlet ? cloneElement(currentOutlet, { key: location.pathname }) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
