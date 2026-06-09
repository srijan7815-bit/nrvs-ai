import { motion } from 'framer-motion'

/**
 * "Thinking" indicator shown while waiting for the first token.
 * Animated bouncing dots + a shimmering label. No avatar/logo.
 */
export default function Thinking() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 pt-1"
    >
      {/* Animated bouncing dots */}
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
      <span className="shimmer text-body-sm">Thinking…</span>
    </motion.div>
  )
}