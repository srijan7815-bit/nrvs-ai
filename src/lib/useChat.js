import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamChat } from './api'
import {
  addMessage,
  createThread,
  getThread,
  updateMessage,
  persistMessageContent,
} from './store'

/**
 * Drives sending a message in a thread (or creating one) and streaming the reply.
 * Accepts a string OR { text, image, model }.
 * Works in both cloud (Supabase) and guest (localStorage) modes.
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

        setBusy(true)
        const controller = new AbortController()
        abortRef.current = controller
        let acc = ''

        try {
          await streamChat({
            messages: history,
            model,
            image,
            signal: controller.signal,
            onToken: (chunk) => {
              acc += chunk
              updateMessage(threadId, assistantId, acc) // in-memory, fast
            },
          })
          const finalText = acc.trim() ? acc : '_(No response received.)_'
          updateMessage(threadId, assistantId, finalText)
          await persistMessageContent(assistantId, finalText)
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
