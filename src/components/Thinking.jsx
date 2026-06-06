import { motion } from 'framer-motion'
import Mark from './Mark'

/**
 * "Thinking" indicator shown while waiting for the first token.
 * Animated bouncing dots + a shimmering label. (No spin on the brand mark.)
 */
export default function Thinking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full items-center gap-3"
    >
      <div className="mt-0.5 flex h-8 shrink-0 items-center justify-center rounded-pill border border-border bg-surface px-2.5">
        <Mark size={30} />
      </div>

      <div className="flex items-center gap-2 pt-1.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-1.5 w-1.5 rounded-full bg-text-tertiary"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <span className="shimmer text-body-sm">NRVS is thinking…</span>
      </div>
    </motion.div>
  )
}
