import { useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Copy, Check, Brain, AppWindow } from 'lucide-react'
import Markdown from '../lib/markdown.jsx'
import Mark from './Mark'
import ToolChips from './ToolChips'
import { USER_INITIAL } from './nav'
import { modelLabel } from '../lib/models'
import { speak, stopSpeaking, ttsSupported } from '../lib/speech'
import { addMemory } from '../lib/memory'
import { parseCodeBlocks, compileArtifact, useArtifacts } from '../lib/artifacts'

export default function Message({ role, content, image, model, tools, streaming, shared }) {
  const isUser = role === 'user'
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remembered, setRemembered] = useState(false)
  const { openArtifact } = useArtifacts()

  // Detect a previewable web artifact in assistant messages.
  const blocks = !isUser ? parseCodeBlocks(content) : []
  const hasPreviewable = blocks.some((b) =>
    ['html', 'htm', 'css', 'js', 'javascript', 'svg'].includes(
      (b.language || '').toLowerCase()
    )
  )

  const onSpeak = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    speak(content)
    setSpeaking(true)
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

  const onRemember = async () => {
    await addMemory(content, 'manual')
    setRemembered(true)
    setTimeout(() => setRemembered(false), 1800)
  }

  const onOpenArtifact = () => {
    openArtifact({
      type: 'html',
      title: blocks.find((b) => b.filename)?.filename || 'Preview',
      content: compileArtifact(blocks),
    })
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
          <Mark size={18} />
        </div>
      )}

      <div className={isUser ? 'max-w-[80%]' : 'max-w-[85%] pt-1'}>
        {isUser ? (
          <>
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
            {/* Memory save on user messages */}
            {content && !shared && (
              <div className="mt-1 flex justify-end">
                <button
                  onClick={onRemember}
                  className={`flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption transition-colors hover:bg-border ${
                    remembered
                      ? 'text-accent-blue'
                      : 'text-text-tertiary hover:text-text-primary'
                  }`}
                  title="Ask NRVS to remember this"
                >
                  {remembered ? <Check size={13} /> : <Brain size={13} />}
                  {remembered ? 'Remembered' : 'Remember'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {model && (
              <div className="mb-1 text-caption text-text-tertiary">
                {modelLabel(model)}
              </div>
            )}
            <ToolChips tools={tools} />
            <Markdown text={content} />
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-tertiary align-middle" />
            )}

            {!streaming && content && !shared && (
              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={onCopy}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
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
                    title="Read aloud"
                  >
                    {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                )}
                <button
                  onClick={onRemember}
                  className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-border ${
                    remembered
                      ? 'text-accent-blue'
                      : 'text-text-tertiary hover:text-text-primary'
                  }`}
                  title="Remember this"
                >
                  {remembered ? <Check size={14} /> : <Brain size={14} />}
                </button>
              </div>
            )}

            {/* Open artifact footer */}
            {!streaming && hasPreviewable && (
              <button
                onClick={onOpenArtifact}
                className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2.5 text-left transition-colors hover:bg-border"
              >
                <AppWindow size={16} className="text-accent-orange" />
                <span className="flex-1 text-body-sm text-text-primary">
                  Open compiled preview
                </span>
                <span className="text-caption text-text-tertiary">Artifact →</span>
              </button>
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
