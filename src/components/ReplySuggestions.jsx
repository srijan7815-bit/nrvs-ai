import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquarePlus, Sparkles } from 'lucide-react'
import { haptic } from '../lib/haptics'

/**
 * Displays 2-3 clickable reply suggestion chips below the last assistant message.
 * Each chip shows a short label but sends the full structured prompt when clicked.
 */
export default function ReplySuggestions({ suggestions, onPick, loading }) {
  if ((!suggestions || suggestions.length === 0) && !loading) return null

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-1.5 text-caption text-text-tertiary">
        <Sparkles size={11} className="text-accent-blue" />
        <span>Suggested replies</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {loading ? (
            // Skeleton loading chips
            <>
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="h-8 w-28 animate-pulse rounded-pill bg-surface2"
                />
              ))}
            </>
          ) : (
            suggestions.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                onClick={() => {
                  haptic('light')
                  onPick(s)
                }}
                className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-body-sm text-text-secondary transition-colors hover:border-accent-blue/40 hover:bg-accent-blue/10 hover:text-accent-blue"
              >
                <MessageSquarePlus size={12} />
                <span>{s.short}</span>
              </motion.button>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
