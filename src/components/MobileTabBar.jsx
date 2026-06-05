import { Menu, Circle, ChevronLeft } from 'lucide-react'

/**
 * Bottom system-style nav bar shown in the mobile mockups
 * (hamburger / home circle / back chevron).
 */
export default function MobileTabBar() {
  return (
    <div className="flex h-12 items-center justify-around border-t border-border/60 px-6 text-text-tertiary">
      <Menu size={20} strokeWidth={1.75} />
      <Circle size={18} strokeWidth={1.75} />
      <ChevronLeft size={20} strokeWidth={1.75} />
    </div>
  )
}
