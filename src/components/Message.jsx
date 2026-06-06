import { useState } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, Copy, Check, Brain, AppWindow, BookmarkPlus, Pencil, RefreshCw, X } from 'lucide-react'
import Markdown from '../lib/markdown.jsx'
import Mark from './Mark'
import ToolChips from './ToolChips'
import { USER_INITIAL } from './nav'
import { modelLabel } from '../lib/models'
import { speak, stopSpeaking, ttsSupported } from '../lib/speech'
import { addMemory } from '../lib/memory'
import { parseCodeBlocks, compileArtifact, useArtifacts } from '../lib/artifacts'
import { saveToLibrary } from '../lib/library'
import { haptic } from '../lib/haptics'
import { useProfile } from '../lib/profile'

export default function Message({
  role,
  content,
  image,
  model,
  tools,
  streaming,
  shared,
  threadId,
  onEdit,
  onRetry,
}) {
  const isUser = role === 'user'
  const { name } = useProfile()
  const userInitial = (name || USER_INITIAL).charAt(0).toUpperCase()
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [remembered, setRemembered] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
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

  const fileCount = blocks.filter((b) => b.filename).length
  const artifactTitle = () => {
    const named = blocks.find((b) => b.filename)?.filename
    if (fileCount > 1) return `Project (${blocks.length} files)`
    return named || 'Preview'
  }

  const onOpenArtifact = () => {
    openArtifact({
      type: 'html',
      title: artifactTitle(),
      content: compileArtifact(blocks),
      files: blocks.map((b, i) => ({
        name: b.filename || `${b.language || 'file'}-${i + 1}`,
        language: b.language,
        code: b.code,
      })),
    })
  }

  const onSaveLibrary = async () => {
    haptic('success')
    await saveToLibrary({
      title: artifactTitle(),
      kind: 'html',
      content: compileArtifact(blocks),
      threadId,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`flex w-full gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-8 shrink-0 items-center justify-center rounded-pill border border-border bg-surface px-2.5">
          <Mark size={30} />
        </div>
      )}

      <div className={isUser ? 'max-w-[80%]' : 'max-w-[85%] pt-1'}>
        {isUser ? (
          <>
            {editing ? (
              <div className="rounded-lg border border-border bg-surface2 p-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={Math.min(8, (draft.match(/\n/g)?.length || 0) + 2)}
                  className="w-full resize-none bg-transparent px-2 py-1 text-body text-text-primary focus:outline-none"
                />
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setDraft(content)
                      setEditing(false)
                    }}
                    className="flex items-center gap-1 rounded-pill px-3 py-1.5 text-body-sm text-text-tertiary hover:bg-border"
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    onClick={() => {
                      const next = draft.trim()
                      setEditing(false)
                      if (next && next !== content) onEdit?.(next)
                    }}
                    className="btn-primary h-8 px-4 text-body-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
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
            )}

            {/* User message actions */}
            {content && !shared && !editing && (
              <div className="mt-1 flex justify-end gap-1">
                <button
                  onClick={onCopy}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                  title="Copy"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {onEdit && (
                  <button
                    onClick={() => {
                      setDraft(content)
                      setEditing(true)
                    }}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                    title="Edit & resend"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                )}
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
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
                    title="Retry / regenerate"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Artifact footer: open preview + save to library */}
            {!streaming && hasPreviewable && !shared && (
              <div className="mt-2 overflow-hidden rounded-md border border-border bg-surface2">
                <button
                  onClick={onOpenArtifact}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-border"
                >
                  <AppWindow size={16} className="text-accent-orange" />
                  <span className="flex-1 text-body-sm text-text-primary">
                    Open compiled preview
                  </span>
                  <span className="text-caption text-text-tertiary">
                    {fileCount > 1 ? `${blocks.length} files →` : 'Artifact →'}
                  </span>
                </button>
                <button
                  onClick={onSaveLibrary}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left transition-colors hover:bg-border"
                >
                  {saved ? (
                    <Check size={16} className="text-accent-blue" />
                  ) : (
                    <BookmarkPlus size={16} className="text-text-secondary" />
                  )}
                  <span className="flex-1 text-body-sm text-text-primary">
                    {saved ? 'Saved to Library' : 'Save to Library'}
                  </span>
                </button>
              </div>
            )}
            {/* shared view: read-only open preview */}
            {!streaming && hasPreviewable && shared && (
              <button
                onClick={onOpenArtifact}
                className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2.5 text-left transition-colors hover:bg-border"
              >
                <AppWindow size={16} className="text-accent-orange" />
                <span className="flex-1 text-body-sm text-text-primary">
                  Open compiled preview
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-surface2 text-body-sm font-medium text-text-primary ring-1 ring-border">
          {userInitial}
        </div>
      )}
    </motion.div>
  )
}
