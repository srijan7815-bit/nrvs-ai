import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { streamChat, extractMemories, generateSite } from './api'
import {
  addMessage,
  createThread,
  getThread,
  updateMessage,
  setMessageTools,
  persistMessageContent,
  truncateFromMessage,
} from './store'
import { getMemories, addMemory } from './memory'
import { getServers } from './mcp'
import { filesForProject } from './projects'
import { setBusy, setError, useBusy } from './busy'
import { getProviderKey } from './providers'

// Detect a "build me a website/app/page/landing/site" request.
const SITE_INTENT =
  /\b(build|make|create|design|generate|code)\b[\s\S]{0,40}\b(website|web ?site|web ?app|web ?page|landing ?page|portfolio site|homepage|site for|webpage)\b/i

// Abort controllers keyed by threadId so stop() works from any screen/instance.
const controllers = new Map()

/**
 * Sends a message + streams the reply, with tool activity, memory injection,
 * and automatic memory extraction. Busy/error state is GLOBAL (shared across
 * screens) so the thinking animation shows even right after navigating to a
 * freshly-created thread. Pass a threadId to scope busy to that thread.
 */
export function useChat(scopeThreadId) {
  const { busy, error } = useBusy(scopeThreadId)
  const navigate = useNavigate()

  const send = useCallback(
    async (payload, threadIdArg) => {
      const { text, image, model, file } =
        typeof payload === 'string' ? { text: payload } : payload || {}
      if (!text && !image && !file) return

      setError(null)
      let threadId = threadIdArg

      // What we show in the bubble vs. what we send to the model.
      const displayText = text || ''
      let sendText = text || ''
      if (file?.text) {
        sendText +=
          `\n\n--- Attached file: ${file.name} ---\n` +
          file.text.slice(0, 60000) +
          `\n--- end of file ---`
      } else if (file && !file.text) {
        sendText += `\n\n(User attached a binary/non-text file: ${file.name}. You cannot read its contents directly.)`
      }

      try {
        if (!threadId) {
          threadId = await createThread(displayText || file?.name || 'File')
          navigate(`/thread/${threadId}`)
        }

        await addMessage(threadId, {
          role: 'user',
          content: displayText,
          image: image || null,
          file: file ? { name: file.name, size: file.size } : null,
        })
        const assistantId = await addMessage(threadId, {
          role: 'assistant',
          content: '',
          model: model || null,
        })

        const history = (getThread(threadId)?.messages || [])
          .filter((m) => m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }))
        // Substitute the latest user turn with the version that includes file content.
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === 'user') {
            history[i] = { role: 'user', content: sendText || history[i].content }
            break
          }
        }

        const memList = getMemories().map((m) => m.content)
        // If this thread belongs to a project, share that project's files/context.
        const thr = getThread(threadId)
        if (thr?.projectId) {
          const pf = filesForProject(thr.projectId)
          for (const f of pf) {
            if (f.content) {
              memList.push(
                `Project file "${f.name}":\n${String(f.content).slice(0, 8000)}`
              )
            } else {
              memList.push(`Project has a file named "${f.name}".`)
            }
          }
        }
        const mcpList = getServers()
          .filter((s) => s.enabled)
          .map((s) => `${s.name} (${s.url})`)

        setBusy(threadId, true)
        const controller = new AbortController()
        controllers.set(threadId, controller)
        let acc = ''
        const toolEvents = []

        // ── Website build path: use FUISHAN (if Google key) or rich native gen ──
        const isSiteBuild = SITE_INTENT.test(displayText || '')
        if (isSiteBuild) {
          try {
            const googleKey = getProviderKey('googleai')
            const { source } = await generateSite({
              prompt: sendText,
              googleKey,
              model,
              signal: controller.signal,
              onToken: (full) => {
                const code = full
                  .replace(/^[\s\S]*?__END_BRIEF__\n?/, '')
                  .replace(/__NRVS_SOURCE__\w+\n?/, '')
                  .replace(/^\s+/, '')
                updateMessage(threadId, assistantId, code || '_Building your site…_')
              },
            })
            const cur = getThread(threadId)?.messages.find((x) => x.id === assistantId)
            let finalText = (cur?.content || '').trim() || '_(No site generated.)_'
            const tag =
              source === 'fuishan'
                ? '_Generated with FUISHAN. Open the preview below._\n\n'
                : ''
            finalText = tag + finalText
            updateMessage(threadId, assistantId, finalText)
            await persistMessageContent(assistantId, finalText)
          } catch (err) {
            if (err.name !== 'AbortError') {
              const t = `_Couldn't build the site: ${err.message}_`
              updateMessage(threadId, assistantId, t)
              await persistMessageContent(assistantId, t)
            }
          } finally {
            setBusy(threadId, false)
            controllers.delete(threadId)
          }
          return threadId
        }

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
              // trim the leading keep-alive whitespace so it never shows
              updateMessage(threadId, assistantId, acc.replace(/^\s+/, ''))
            },
            onTool: (evt) => {
              toolEvents.push(evt)
              setMessageTools(threadId, assistantId, [...toolEvents])
            },
          })
          acc = acc.replace(/^\s+/, '')
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
          setBusy(threadId, false)
          controllers.delete(threadId)
        }
      } catch (err) {
        if (threadId) setBusy(threadId, false)
        setError(err.message || 'Failed to send message.')
      }

      return threadId
    },
    [navigate]
  )

  const stop = useCallback(() => {
    if (scopeThreadId) controllers.get(scopeThreadId)?.abort()
    else controllers.forEach((c) => c.abort())
  }, [scopeThreadId])

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
