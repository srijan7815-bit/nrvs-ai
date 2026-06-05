import { useEffect, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Square } from 'lucide-react'
import Layout from '../components/Layout'
import Composer from '../components/Composer'
import Message from '../components/Message'
import { useThread } from '../lib/store'
import { useChat } from '../lib/useChat'

export default function Thread() {
  const { id } = useParams()
  const thread = useThread(id)
  const { send, stop, busy, error } = useChat()
  const bottomRef = useRef(null)

  const messages = thread?.messages || []
  const lastId = messages[messages.length - 1]?.id

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy, lastId])

  if (!thread) return <Navigate to="/" replace />

  return (
    <Layout>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 sm:px-6">
        <div className="flex-1 space-y-6 overflow-y-auto py-6">
          {messages.map((m, idx) => (
            <Message
              key={m.id}
              role={m.role}
              content={m.content}
              image={m.image}
              model={m.model}
              streaming={
                busy && idx === messages.length - 1 && m.role === 'assistant'
              }
            />
          ))}
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
          <Composer onSend={(p) => send(p, id)} disabled={busy} />
        </div>
      </div>
    </Layout>
  )
}
