import { useEffect, useRef, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Square, Share2 } from 'lucide-react'
import Layout from '../components/Layout'
import Composer from '../components/Composer'
import Message from '../components/Message'
import Thinking from '../components/Thinking'
import ShareDialog from '../components/ShareDialog'
import LiveMode from '../components/LiveMode'
import { useThread } from '../lib/store'
import { useChat } from '../lib/useChat'
import { syncLiveShares } from '../lib/shares'

export default function Thread() {
  const { id } = useParams()
  const thread = useThread(id)
  const { send, stop, editAndRetry, retry, busy, error } = useChat()
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy, lastId])

  // Keep any LIVE share links for this thread up to date when not streaming.
  useEffect(() => {
    if (!busy && id) syncLiveShares(id)
  }, [messages.length, busy, id])

  if (!thread) return <Navigate to="/" replace />

  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 sm:px-6">
        {/* Thread header with share */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 py-3">
          <h2 className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
            {thread.title}
          </h2>
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
          {showThinking && <Thinking />}
          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-body-sm text-danger">
              {error}
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
          <Composer onSend={(p) => send(p, id)} onLive={() => setLive(true)} disabled={busy} />
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        threadId={id}
        onClose={() => setShareOpen(false)}
      />
      <LiveMode open={live} onClose={() => setLive(false)} />
    </Layout>
  )
}
