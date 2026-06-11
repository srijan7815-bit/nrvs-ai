import { useEffect, useRef, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Square, Share2 } from 'lucide-react'
import Layout from '../components/Layout'
import Composer from '../components/Composer'
import Message from '../components/Message'
import Thinking from '../components/Thinking'
import ShareDialog from '../components/ShareDialog'
import LiveMode from '../components/LiveMode'
import AddToProject from '../components/AddToProject'
import ContinueButton from '../components/ContinueButton'
import ReplySuggestions from '../components/ReplySuggestions'
import { useThread } from '../lib/store'
import { useChat } from '../lib/useChat'
import { useFlowLauncher } from '../lib/useFlowLauncher'
import { syncLiveShares } from '../lib/shares'
import { looksTruncated } from '../lib/markdown'

export default function Thread() {
  const { id } = useParams()
  const thread = useThread(id)
  const { send, stop, editAndRetry, retry, continueResponse, suggestions, suggestionsLoading, clearSuggestions, busy, error } = useChat(id)
  const { launch, overlay } = useFlowLauncher()

  const handleSend = (p) => {
    if (p?.flowState && p.text) return launch(p.text, p.model)
    return send(p, id)
  }

  // Handle suggestion click: send the full prompt, display the short version in composer
  const handleSuggestionPick = (suggestion) => {
    // Send with the FULL structured prompt as text, but we'll show short in the bubble
    send({ text: suggestion.full }, id)
  }

  const bottomRef = useRef(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [live, setLive] = useState(false)

  const messages = thread?.messages || []
  const lastMsg = messages[messages.length - 1]
  const lastId = lastMsg?.id
  const lastEmpty =
    lastMsg?.role === 'assistant' &&
    (!lastMsg.content || lastMsg.content.length === 0)
  const lastHasTools = lastMsg?.tools && lastMsg.tools.length > 0
  const showThinking = busy && lastEmpty && !lastHasTools

  // Detect if the last assistant response is truncated (for continue button)
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')
  const isLastTruncated =
    !busy &&
    lastAssistantMsg &&
    lastAssistantMsg.content &&
    looksTruncated(lastAssistantMsg.content)

  // Show suggestions only for the current thread and when response is complete
  const showSuggestions =
    !busy &&
    !isLastTruncated &&
    suggestions.length > 0 &&
    suggestions[0]?.threadId === id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy, lastId])

  // Keep any LIVE share links for this thread up to date when not streaming.
  useEffect(() => {
    if (!busy && id) syncLiveShares(id)
  }, [messages.length, busy, id])

  // Clear suggestions when navigating to a different thread
  useEffect(() => {
    clearSuggestions()
  }, [id])

  if (!thread) return <Navigate to="/" replace />

  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 sm:px-6">
        {/* Thread header with share */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="min-w-0 truncate text-body font-medium text-text-primary">
              {thread.title}
            </h2>
            {thread.shared && (
              <span className="shrink-0 rounded-pill border border-border bg-surface2 px-2 py-0.5 text-caption uppercase tracking-wide text-text-tertiary">
                Shared
              </span>
            )}
          </div>
          <AddToProject threadId={id} currentProjectId={thread.projectId} />
          <button
            onClick={() => setShareOpen(true)}
            className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm text-text-secondary"
            title="Share this chat"
          >
            <Share2 size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto py-6">
          {messages.map((m, idx) => {
            const isLast = idx === messages.length - 1
            if (showThinking && isLast && m.role === 'assistant') return null
            return (
              <Message
                key={m.id}
                role={m.role}
                content={m.content}
                image={m.image}
                model={m.model}
                tools={m.tools}
                threadId={id}
                streaming={busy && isLast && m.role === 'assistant'}
                onEdit={
                  m.role === 'user' && !busy
                    ? (text) => editAndRetry(id, m.id, text)
                    : undefined
                }
                onRetry={
                  m.role === 'assistant' && !busy
                    ? () => retry(id, m.id)
                    : undefined
                }
              />
            )
          })}
          {showThinking && (
            <div className="max-w-[85%] pt-1">
              <Thinking />
            </div>
          )}
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-body-sm text-danger">
              {error}
            </div>
          )}

          {/* Continue button — shown when last response is truncated */}
          {isLastTruncated && (
            <div className="max-w-[85%]">
              <ContinueButton onClick={() => continueResponse(id)} />
            </div>
          )}

          {/* Reply suggestions — shown after complete responses */}
          {showSuggestions && (
            <div className="max-w-[85%]">
              <ReplySuggestions
                suggestions={suggestions}
                onPick={handleSuggestionPick}
                loading={false}
              />
            </div>
          )}
          {suggestionsLoading && (
            <div className="max-w-[85%]">
              <ReplySuggestions suggestions={[]} onPick={() => {}} loading={true} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="pb-6">
          {busy && (
            <div className="mb-2 flex justify-center">
              <button
                onClick={stop}
                className="btn-icon flex h-8 items-center gap-1.5 px-3 text-body-sm text-text-secondary"
              >
                <Square size={12} strokeWidth={2} fill="currentColor" />
                Stop
              </button>
            </div>
          )}
          <Composer onSend={handleSend} onLive={() => setLive(true)} disabled={busy} />
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        threadId={id}
        onClose={() => setShareOpen(false)}
      />
      <LiveMode open={live} onClose={() => setLive(false)} />
      {overlay}
    </Layout>
  )
}
