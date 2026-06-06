import { motion } from 'framer-motion'
import { haptic } from '../lib/haptics'

/**
 * Toggle switch.
 * Width 44 / Height 24, thumb #FFFFFF.
 * Off: #2A2A2A, On: #4A90E2 — smooth 200ms animation.
 */
export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic('select')
        onChange?.(!checked)
      }}
      className="relative inline-flex shrink-0 items-center rounded-pill transition-colors duration-200 ease-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/60"
      style={{
        width: 44,
        height: 24,
        backgroundColor: checked ? '#4A90E2' : 'var(--c-border)',
        padding: 2,
      }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="block rounded-pill bg-white shadow"
        style={{
          width: 20,
          height: 20,
          marginLeft: checked ? 20 : 0,
        }}
      />
    </button>
  )
}
