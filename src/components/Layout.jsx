import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import SidebarContent from './SidebarContent'
import MobileHeader from './MobileHeader'
import { useSidebarWidth } from '../lib/useSidebarWidth'

/**
 * Responsive shell.
 * - Desktop (≥1025px): resizable sidebar on the left (180px–400px, draggable handle).
 * - Mobile (≤1024px): sidebar becomes a slide-in overlay (300ms ease), with a top bar + bottom tab bar.
 */
export default function Layout({ children, mobileHeaderRight }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { width, setWidth, min, max } = useSidebarWidth()
  const dragRef = useRef({ active: false, startX: 0, startW: 0 })

  // Close the overlay when resizing up to desktop.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1025) setOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Global drag handlers — attach once, clean up on unmount.
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    setWidth(dragRef.current.startW + dx)
  }, [setWidth])

  const onMouseUp = useCallback(() => {
    dragRef.current.active = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const startDrag = (e) => {
    e.preventDefault()
    dragRef.current = { active: true, startX: e.clientX, startW: width }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text-primary">
      {/* Desktop resizable sidebar */}
      <aside
        className="hidden shrink-0 border-r border-border bg-bg lg:block"
        style={{ width, position: 'relative' }}
      >
        <SidebarContent />
        {/* Resize handle — right edge of sidebar */}
        <div
          onMouseDown={startDrag}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-accent-blue/50 active:bg-accent-blue/70"
          style={{ top: 0 }}
          title="Drag to resize"
        />
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