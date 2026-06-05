import { Menu, PanelRightOpen } from 'lucide-react'

/** Mobile top bar: hamburger (open sidebar) on the left, new-thread/panel icon on the right. */
export default function MobileHeader({ onMenu, onNew, right }) {
  return (
    <header className="flex h-14 items-center justify-between px-4">
      <button
        onClick={onMenu}
        className="btn-icon h-10 w-10 border-transparent bg-transparent"
        aria-label="Open menu"
      >
        <Menu size={22} strokeWidth={1.75} />
      </button>
      {right ?? (
        <button
          onClick={onNew}
          className="btn-icon h-10 w-10 border-transparent bg-transparent"
          aria-label="New thread"
        >
          <PanelRightOpen size={20} strokeWidth={1.75} />
        </button>
      )}
    </header>
  )
}
