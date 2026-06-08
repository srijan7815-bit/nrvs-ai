import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, X, Plus, Check } from 'lucide-react'
import { addMemory } from '../lib/memory'
import { haptic } from '../lib/haptics'

const springIn = {
  initial: { opacity: 0, scale: 0.88, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.93, y: 4 },
  transition: { type: 'spring', stiffness: 480, damping: 32 },
}

const cardVariants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: { type: 'spring', stiffness: 520, damping: 30, delay: 0.04 },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
}

const contentVariants = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.12, duration: 0.15 },
  },
  exit: {
    opacity: 0,
    y: -2,
    transition: { duration: 0.1 },
  },
}

/**
 * Animated popup for manually adding a memory.
 * Expands vertically as the user types.
 *
 * @param {boolean}  open        — show the popup
 * @param {string}   prefill     — text to pre-fill (e.g. the message content)
 * @param {function} onClose     — dismiss without saving
 * @param {function} onSuccess   — called after memory is saved successfully
 */
export default function MemoryPopup({ open, prefill = '', onClose, onSuccess }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const textareaRef = useRef(null)

  // Sync prefill when popup opens.
  useEffect(() => {
    if (open) {
      setText(prefill)
      setAdded(false)
      setAdding(false)
      // Focus the textarea after the open animation settles.
      const id = setTimeout(() => textareaRef.current?.focus(), 180)
      return () => clearTimeout(id)
    }
  }, [open, prefill])

  // Auto-grow textarea height.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [text])

  const handleAdd = async () => {
    const trimmed = text.trim()
    if (!trimmed || adding || added) return
    setAdding(true)
    haptic('success')
    await addMemory(trimmed, 'manual')
    setAdding(false)
    setAdded(true)
    // Brief success flash then close.
    setTimeout(() => {
      onSuccess?.()
      onClose?.()
    }, 600)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    }
  }

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div {...springIn} className="relative z-50">
          {/* Card with animated height */}
          <motion.div
            {...cardVariants}
            className="w-[268px] overflow-hidden rounded-xl border border-border bg-surface2 shadow-2xl"
          >
            {/* Content — fades in after the card has opened */}
            <motion.div {...contentVariants}>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                {added ? (
                  <Check size={14} className="text-accent-blue shrink-0" />
                ) : (
                  <Brain size={14} className="text-accent-blue shrink-0" />
                )}
                <span className="text-body-sm font-medium text-text-primary">
                  {added ? 'Saved to Memory' : 'Remember this'}
                </span>
              </div>

              {/* Textarea */}
              <div className="px-3 pb-1">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What should NRVS remember?"
                  rows={1}
                  className="w-full resize-none bg-transparent px-1 py-1 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
                  style={{
                    minHeight: '28px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-3 pb-3 pt-1">
                {!added && (
                  <button
                    onClick={() => onClose?.()}
                    className="flex h-7 items-center gap-1 rounded-pill px-3 text-caption text-text-tertiary hover:bg-border hover:text-text-primary transition-colors"
                  >
                    <X size={12} /> Cancel
                  </button>
                )}
                {!added && (
                  <button
                    onClick={handleAdd}
                    disabled={!text.trim() || adding}
                    className="flex h-7 items-center gap-1.5 rounded-pill bg-accent-blue px-3 text-caption font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                  >
                    {adding ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                        className="block h-3 w-3 rounded-full border-[1.5px] border-white/40 border-t-white"
                      />
                    ) : (
                      <Plus size={12} />
                    )}
                    Add
                  </button>
                )}
                {added && (
                  <span className="text-caption text-accent-blue">Added ✓</span>
                )}
              </div>
            </motion.div>
          </motion.div>

          {/* Keyboard shortcut hint */}
          <motion.p
            {...contentVariants}
            className="mt-1.5 text-center text-caption text-text-tertiary"
          >
            ⌘↵ to save · Esc to dismiss
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}