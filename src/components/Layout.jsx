import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SidebarContent from './SidebarContent'
import MobileHeader from './MobileHeader'

/**
 * Responsive shell.
 * - Desktop (≥1025px): fixed 280px sidebar on the left.
 * - Mobile (≤1024px): sidebar becomes a slide-in overlay (300ms ease), with a top bar + bottom tab bar.
 */
export default function Layout({ children, mobileHeaderRight }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Close the overlay when resizing up to desktop.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1025) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
      {/* Desktop fixed sidebar */}
      <aside className="hidden w-sidebar shrink-0 border-r border-border bg-bg lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85%] border-r border-border bg-bg lg:hidden"
            >
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="lg:hidden">
          <MobileHeader
            onMenu={() => setOpen(true)}
            onNew={() => navigate('/')}
            right={mobileHeaderRight}
          />
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
