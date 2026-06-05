import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamChat } from './api'
import {
  addMessage,
  createThread,
  getThread,
  updateMessage,
} from './store'

/**
 * Drives sending a message in a thread (or creating one) and streaming the reply.
 * Returns { send, busy, error }.
 */
export function useChat() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const abortRef = useRef(null)

  const send = useCallback(
    async (text, threadIdArg) => {
      setError(null)
      let threadId = threadIdArg

      // Create a thread on first message from Home.
      if (!threadId) {
        threadId = createThread(text)
        navigate(`/thread/${threadId}`)
      }

      addMessage(threadId, { role: 'user', content: text })
      const assistantId = addMessage(threadId, {
        role: 'assistant',
        content: '',
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
          signal: controller.signal,
          onToken: (chunk) => {
            acc += chunk
            updateMessage(threadId, assistantId, acc)
          },
        })
        if (!acc.trim()) {
          updateMessage(
            threadId,
            assistantId,
            '_(No response received.)_'
          )
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          updateMessage(threadId, assistantId, acc + '\n\n_(Stopped.)_')
        } else {
          setError(err.message || 'Something went wrong.')
          updateMessage(
            threadId,
            assistantId,
            acc + `\n\n_Error: ${err.message || 'request failed'}_`
          )
        }
      } finally {
        setBusy(false)
        abortRef.current = null
      }

      return threadId
    },
    [navigate]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { send, stop, busy, error }
}
