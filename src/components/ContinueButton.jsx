import { motion } from 'framer-motion'
import { FastForward } from 'lucide-react'
import { haptic } from '../lib/haptics'

/**
 * A "Continue" button shown when the last assistant response appears
 * truncated / cut off mid-way. Clicking it sends a continuation request.
 */
export default function ContinueButton({ onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-3"
    >
      <button
        onClick={() => {
          haptic('light')
          onClick()
        }}
        className="flex items-center gap-2 rounded-pill border border-accent-orange/40 bg-accent-orange/10 px-4 py-2 text-body-sm text-accent-orange transition-colors hover:bg-accent-orange/20"
      >
        <FastForward size={14} />
        Continue response
      </button>
      <p className="mt-1.5 text-caption text-text-tertiary">
        Response was cut off. Click to continue from where it stopped.
      </p>
    </motion.div>
  )
}
