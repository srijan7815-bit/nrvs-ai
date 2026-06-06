import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Mic, MicOff, Square, PhoneOff } from 'lucide-react'
import { createRecognizer, speechSupported, speak, stopSpeaking, ttsSupported } from '../lib/speech'
import { chatOnce } from '../lib/api'
import { getMemories } from '../lib/memory'
import { usePrefs } from '../lib/prefs'
import { haptic } from '../lib/haptics'

// States: idle -> listening -> thinking -> speaking -> (loop) listening
export default function LiveMode({ open, onClose }) {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const [prefs] = usePrefs()

  const recRef = useRef(null)
  const historyRef = useRef([]) // {role, content}
  const activeRef = useRef(false)
  const mutedRef = useRef(false)

  const supported = speechSupported() && ttsSupported()

  useEffect(() => {
    if (open) {
      historyRef.current = []
      setTranscript('')
      setReply('')
      setError('')
      if (supported) {
        activeRef.current = true
        startListening()
      }
    } else {
      teardown()
    }
    return teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function teardown() {
    activeRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
    recRef.current = null
    stopSpeaking()
    setPhase('idle')
  }

  function startListening() {
    if (!activeRef.current) return
    if (mutedRef.current) {
      setPhase('muted')
      return
    }
    setTranscript('')
    setPhase('listening')
    const rec = createRecognizer({
      onResult: (text) => setTranscript(text),
      onEnd: (finalText) => {
        const said = (finalText || '').trim()
        if (said) handleUser(said)
        else if (activeRef.current) startListening() // heard nothing, listen again
      },
      onError: () => {
        if (activeRef.current) setTimeout(startListening, 600)
      },
    })
    if (!rec) {
      setError('Voice recognition unavailable.')
      return
    }
    recRef.current = rec
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }

  async function handleUser(text) {
    haptic('light')
    setPhase('thinking')
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]
    try {
      const out = await chatOnce({
        messages: historyRef.current,
        model: prefs.model,
        memories: getMemories().map((m) => m.content),
      })
      if (!activeRef.current) return
      historyRef.current = [...historyRef.current, { role: 'assistant', content: out }]
      setReply(out)
      speakReply(out)
    } catch (e) {
      setError('Could not reach NRVS.')
      if (activeRef.current) setTimeout(startListening, 800)
    }
  }

  function speakReply(text) {
    setPhase('speaking')
    // speak, then resume listening when done
    stopSpeaking()
    const clean = text
      .replace(/```[\s\S]*?```/g, ' (code shown in chat) ')
      .replace(/[*_`#>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim()
    if (!ttsSupported() || !clean) {
      if (activeRef.current) startListening()
      return
    }
    const u = new SpeechSynthesisUtterance(clean)
    u.rate = 1.02
    u.onend = () => {
      if (activeRef.current) startListening()
    }
    u.onerror = () => {
      if (activeRef.current) startListening()
    }
    window.speechSynthesis.speak(u)
  }

  // Interrupt: stop NRVS speaking and immediately go back to listening.
  function interrupt() {
    haptic('medium')
    stopSpeaking()
    if (activeRef.current && !mutedRef.current) startListening()
  }

  // Mute: stop the mic (and any current recognition). Unmute resumes listening.
  function toggleMute() {
    haptic('select')
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (next) {
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }
      // don't change phase while NRVS is speaking; otherwise show muted
      if (phase !== 'speaking') setPhase('muted')
    } else {
      if (phase !== 'speaking') startListening()
    }
  }

  const label =
    phase === 'muted'
      ? 'Muted'
      : phase === 'listening'
      ? 'Listening…'
      : phase === 'thinking'
      ? 'Thinking…'
      : phase === 'speaking'
      ? 'NRVS is speaking…'
      : 'Live mode'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-bg px-6 text-center"
        >
          <button
            onClick={onClose}
            className="btn-icon absolute right-5 top-5 h-10 w-10"
            aria-label="End live mode"
          >
            <X size={18} />
          </button>

          {!supported ? (
            <div className="max-w-sm">
              <MicOff className="mx-auto mb-3 text-text-tertiary" size={32} />
              <p className="text-body text-text-secondary">
                Live voice mode needs a browser with Speech Recognition + Speech
                Synthesis (e.g. Chrome). It isn’t available here.
              </p>
            </div>
          ) : (
            <>
              {/* Animated orb */}
              <div className="relative mb-10 flex h-48 w-48 items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(255,138,61,0.45) 0%, rgba(255,138,61,0) 70%)',
                  }}
                  animate={{
                    scale:
                      phase === 'speaking'
                        ? [1, 1.25, 1]
                        : phase === 'listening'
                        ? [1, 1.12, 1]
                        : 1,
                    opacity: phase === 'thinking' ? [0.4, 0.8, 0.4] : 1,
                  }}
                  transition={{
                    duration: phase === 'thinking' ? 1.2 : 1.6,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="h-24 w-24 rounded-full bg-accent-orange"
                  animate={{
                    scale:
                      phase === 'speaking'
                        ? [1, 1.18, 0.95, 1.1, 1]
                        : phase === 'listening'
                        ? [1, 1.06, 1]
                        : 1,
                  }}
                  transition={{
                    duration: phase === 'speaking' ? 0.7 : 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </div>

              <p className="shimmer mb-3 text-heading-md">{label}</p>

              <p className="min-h-[3rem] max-w-md text-body text-text-secondary">
                {phase === 'speaking' && reply
                  ? reply.slice(0, 160)
                  : transcript || (phase === 'listening' ? 'Say something…' : '')}
              </p>

              {error && (
                <p className="mt-3 text-body-sm text-danger">{error}</p>
              )}

              {/* Controls: Mute + Interrupt + End */}
              <div className="absolute bottom-20 flex items-center gap-4">
                <button
                  onClick={toggleMute}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
                    muted
                      ? 'border-danger bg-danger/15 text-danger'
                      : 'border-border bg-surface text-text-primary hover:bg-border'
                  }`}
                  title={muted ? 'Unmute mic' : 'Mute mic'}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <button
                  onClick={interrupt}
                  disabled={phase !== 'speaking'}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-text-primary transition-colors hover:bg-border disabled:opacity-30"
                  title="Interrupt NRVS"
                  aria-label="Interrupt"
                >
                  <Square size={20} fill="currentColor" strokeWidth={0} />
                </button>

                <button
                  onClick={onClose}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-opacity hover:opacity-90"
                  title="End live mode"
                  aria-label="End"
                >
                  <PhoneOff size={20} />
                </button>
              </div>

              <p className="absolute bottom-8 flex items-center gap-1.5 text-caption text-text-tertiary">
                Mute · Interrupt · End
              </p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
