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
  truncateFromMessage,
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

  // Edit a user message: truncate from it (removing it + everything after) and
  // re-send the new text. Preserves the original image if any.
  const editAndRetry = useCallback(
    async (threadId, msgId, newText) => {
      const t = getThread(threadId)
      const orig = t?.messages.find((m) => m.id === msgId)
      const image = orig?.image || null
      await truncateFromMessage(threadId, msgId)
      const lastModel =
        [...(t?.messages || [])]
          .reverse()
          .find((m) => m.role === 'assistant' && m.model)?.model || undefined
      return send({ text: newText, image, model: lastModel }, threadId)
    },
    [send]
  )

  // Retry: regenerate the assistant reply for the most recent user turn,
  // or for a specific assistant message (truncate it + resend the prior user msg).
  const retry = useCallback(
    async (threadId, assistantMsgId) => {
      const t = getThread(threadId)
      if (!t) return
      const idx = t.messages.findIndex((m) => m.id === assistantMsgId)
      if (idx <= 0) return
      // find the user message preceding this assistant reply
      let userIdx = idx - 1
      while (userIdx >= 0 && t.messages[userIdx].role !== 'user') userIdx--
      if (userIdx < 0) return
      const userMsg = t.messages[userIdx]
      const model = t.messages[idx].model || undefined
      // remove the user message + everything after, then resend it
      await truncateFromMessage(threadId, userMsg.id)
      return send(
        { text: userMsg.content, image: userMsg.image || null, model },
        threadId
      )
    },
    [send]
  )

  return { send, stop, editAndRetry, retry, busy, error }
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
