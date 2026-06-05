import { useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Copy, Check } from 'lucide-react'
import Markdown from '../lib/markdown.jsx'
import Sunburst from './Sunburst'
import { USER_INITIAL } from './nav'
import { modelLabel } from '../lib/models'
import { speak, stopSpeaking, ttsSupported } from '../lib/speech'

/** A single chat message row. */
export default function Message({ role, content, image, model, streaming }) {
  const isUser = role === 'user'
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)

  const onSpeak = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    speak(content)
    setSpeaking(true)
    // poll for end
    const t = setInterval(() => {
      if (!window.speechSynthesis?.speaking) {
        setSpeaking(false)
        clearInterval(t)
      }
    }, 400)
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-border bg-surface">
          <Sunburst size={18} />
        </div>
      )}

      <div className={isUser ? 'max-w-[80%]' : 'max-w-[85%] pt-1'}>
        {isUser ? (
          <div className="rounded-lg rounded-tr-sm border border-border bg-surface2 px-4 py-2.5 text-body text-text-primary">
            {image && (
              <img
                src={image}
                alt="attachment"
                className="mb-2 max-h-56 rounded-md border border-border object-contain"
              />
            )}
            {content && <span className="whitespace-pre-wrap">{content}</span>}
          </div>
        ) : (
          <>
            {model && (
              <div className="mb-1 text-caption text-text-tertiary">
                {modelLabel(model)}
              </div>
            )}
            <Markdown text={content} />
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-tertiary align-middle" />
            )}
            {!streaming && content && (
              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={onCopy}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                  aria-label="Copy"
                  title="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                {ttsSupported() && (
                  <button
                    onClick={onSpeak}
                    className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-border ${
                      speaking
                        ? 'text-accent-blue'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                    aria-label="Read aloud"
                    title="Read aloud (text-to-speech)"
                  >
                    {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface2 text-body-sm font-medium text-text-primary ring-1 ring-border">
          {USER_INITIAL}
        </div>
      )}
    </motion.div>
  )
}
