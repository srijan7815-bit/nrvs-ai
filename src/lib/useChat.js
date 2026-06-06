import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamChat, extractMemories } from './api'
import {
  addMessage,
  createThread,
  getThread,
  updateMessage,
  setMessageTools,
  persistMessageContent,
} from './store'
import { memoryContext, getMemories, addMemory } from './memory'
import { getServers } from './mcp'

/**
 * Sends a message + streams the reply, with tool activity, memory injection,
 * and automatic memory extraction. Works in cloud + guest modes.
 */
export function useChat() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const abortRef = useRef(null)

  const send = useCallback(
    async (payload, threadIdArg) => {
      const { text, image, model } =
        typeof payload === 'string' ? { text: payload } : payload || {}
      if (!text && !image) return

      setError(null)
      let threadId = threadIdArg

      try {
        if (!threadId) {
          threadId = await createThread(text || 'Image')
          navigate(`/thread/${threadId}`)
        }

        await addMessage(threadId, {
          role: 'user',
          content: text || '',
          image: image || null,
        })
        const assistantId = await addMessage(threadId, {
          role: 'assistant',
          content: '',
          model: model || null,
        })

        const history = (getThread(threadId)?.messages || [])
          .filter((m) => m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }))

        const memList = getMemories().map((m) => m.content)
        const mcpList = getServers()
          .filter((s) => s.enabled)
          .map((s) => `${s.name} (${s.url})`)

        setBusy(true)
        const controller = new AbortController()
        abortRef.current = controller
        let acc = ''
        const toolEvents = []

        try {
          await streamChat({
            messages: history,
            model,
            image,
            memories: memList,
            mcpServers: mcpList,
            signal: controller.signal,
            onToken: (chunk) => {
              acc += chunk
              updateMessage(threadId, assistantId, acc)
            },
            onTool: (evt) => {
              toolEvents.push(evt)
              setMessageTools(threadId, assistantId, [...toolEvents])
            },
          })
          const finalText = acc.trim() ? acc : '_(No response received.)_'
          updateMessage(threadId, assistantId, finalText)
          await persistMessageContent(assistantId, finalText)

          // Auto-memory extraction (fire-and-forget, non-blocking).
          autoRemember(threadId, assistantId)
        } catch (err) {
          if (err.name === 'AbortError') {
            const stopped = acc + '\n\n_(Stopped.)_'
            updateMessage(threadId, assistantId, stopped)
            await persistMessageContent(assistantId, stopped)
          } else {
            setError(err.message || 'Something went wrong.')
            const errText = acc + `\n\n_Error: ${err.message || 'request failed'}_`
            updateMessage(threadId, assistantId, errText)
            await persistMessageContent(assistantId, errText)
          }
        } finally {
          setBusy(false)
          abortRef.current = null
        }
      } catch (err) {
        setBusy(false)
        setError(err.message || 'Failed to send message.')
      }

      return threadId
    },
    [navigate]
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  return { send, stop, busy, error }
}

// Look at the latest user+assistant turn and quietly save any durable facts.
async function autoRemember(threadId, assistantId) {
  try {
    const t = getThread(threadId)
    if (!t) return
    const recent = t.messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }))
    const facts = await extractMemories(recent)
    for (const f of facts) await addMemory(f, 'auto')
  } catch {
    /* ignore */
  }
}
