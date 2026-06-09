// MemoryPopup: click Brain → hover window with textarea → type + add → success flash → close
// Uses simple opacity + scale spring animation (no height auto, no AnimatePresence cascade)
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Check, X } from 'lucide-react'
import { addMemory } from '../lib/memory'
import { haptic } from '../lib/haptics'

export default function MemoryPopup({ content = '', children, onSuccess }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('idle') // idle | success | error
  const textareaRef = useRef(null)
  const popupRef = useRef(null)

  // When popup opens, focus textarea
  useEffect(() => {
    if (open) {
      setValue(content || '')
      setStatus('idle')
      setTimeout(() => {
        textareaRef.current?.focus()
        const len = textareaRef.current?.value.length || 0
        textareaRef.current?.setSelectionRange(len, len)
      }, 50)
    }
  }, [open, content])

  // Close on outside click (but not if clicking inside popup)
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        // Check if click is on the trigger button (data attribute)
        const trigger = e.target.closest('[data-memory-trigger]')
        if (!trigger) setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Auto-resize textarea
  const handleChange = (e) => {
    setValue(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }

  const handleAdd = async () => {
    const text = value.trim()
    if (!text) return
    haptic('success')
    await addMemory(text, 'manual')
    setStatus('success')
    onSuccess?.(text)
    setTimeout(() => {
      setOpen(false)
    }, 1200)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <div
        data-memory-trigger
        className="relative flex h-full w-full items-center"
      >
        {/* Our trigger children */}
        <div className="flex h-full w-full cursor-pointer items-center" onClick={() => setOpen((v) => !v)}>
          {children}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-surface2 shadow-xl"
          >
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-caption font-medium text-text-secondary">
                  Add to memory
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpen(false) }}
                  className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Auto-resizing textarea */}
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Type something NRVS should remember…"
                rows={2}
                className="w-full resize-none overflow-hidden rounded-lg border border-border bg-surface1 px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-blue focus:outline-none"
                style={{ minHeight: '52px', height: '52px' }}
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-caption text-text-tertiary">
                  ⌘↵ to add
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpen(false) }}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAdd() }}
                    disabled={!value.trim() || status === 'success'}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-caption transition-all ${
                      status === 'success'
                        ? 'bg-accent-blue text-white'
                        : value.trim()
                        ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                        : 'bg-border text-text-tertiary'
                    }`}
                  >
                    {status === 'success' ? (
                      <>
                        <Check size={12} />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Success flash overlay */}
              <AnimatePresence>
                {status === 'success' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center rounded-xl bg-accent-blue/90"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Check size={20} className="text-white" />
                      <span className="text-caption font-medium text-white">
                        Saved to memory
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}