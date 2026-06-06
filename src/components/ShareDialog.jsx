import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Camera, Radio, Copy, Check, Loader2 } from 'lucide-react'
import { createShare } from '../lib/shares'
import { haptic } from '../lib/haptics'

/** Dialog to create a public share link for a thread (snapshot or live). */
export default function ShareDialog({ open, threadId, onClose }) {
  const [mode, setMode] = useState('snapshot')
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setMode('snapshot')
    setCreating(false)
    setLink('')
    setCopied(false)
  }

  const create = async () => {
    setCreating(true)
    haptic('light')
    const id = await createShare(threadId, mode)
    setCreating(false)
    if (id) setLink(`${window.location.origin}/share/${id}`)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      haptic('success')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence onExitComplete={reset}>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-heading-md font-semibold">Share chat</h2>
              <button onClick={onClose} className="btn-icon h-8 w-8">
                <X size={16} />
              </button>
            </div>

            {!link ? (
              <>
                <p className="mb-4 text-body-sm text-text-tertiary">
                  Create a public link. Anyone with it can view this conversation.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => setMode('snapshot')}
                    className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                      mode === 'snapshot'
                        ? 'border-accent-blue bg-surface2'
                        : 'border-border hover:bg-border'
                    }`}
                  >
                    <Camera size={18} className="mt-0.5 text-text-secondary" />
                    <div>
                      <div className="text-body text-text-primary">Snapshot</div>
                      <div className="text-caption text-text-tertiary">
                        Shares the chat as it is now. New messages won’t appear.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setMode('live')}
                    className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                      mode === 'live'
                        ? 'border-accent-blue bg-surface2'
                        : 'border-border hover:bg-border'
                    }`}
                  >
                    <Radio size={18} className="mt-0.5 text-text-secondary" />
                    <div>
                      <div className="text-body text-text-primary">Live</div>
                      <div className="text-caption text-text-tertiary">
                        Always shows the latest messages as you keep chatting.
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={create}
                  disabled={creating}
                  className="btn-primary mt-4 h-11 w-full text-body disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    'Create link'
                  )}
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-body-sm text-text-secondary">
                  Your {mode === 'live' ? 'live' : 'snapshot'} link is ready:
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-text-primary">
                    {link}
                  </span>
                </div>
                <button
                  onClick={copy}
                  className="btn-primary mt-3 h-11 w-full text-body"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <p className="mt-3 text-center text-caption text-text-tertiary">
                  Manage or stop sharing in Settings → Shared links.
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
