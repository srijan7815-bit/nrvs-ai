// Autonomous Flow State runner: works through a mission's plan automatically.
// Executes research → documents → tasks (priority order), saving each result
// inline and marking items done. Reactive + cancellable.
import { useCallback, useRef, useState } from 'react'
import { execItem, getFlow, updateFlowData } from './flows'
import { haptic } from './haptics'

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Polite gap between items to stay under the model's rate limit (long runs).
const ITEM_DELAY_MS = 2500

export function useFlowRunner(flowId, model) {
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState(null) // {kind,title}
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(0)
  const cancelRef = useRef(false)

  // Execute one item with resilient retry/backoff so a transient 429/5xx
  // never kills a long autonomous run.
  const execResilient = async (payload) => {
    let attempt = 0
    while (!cancelRef.current) {
      try {
        const out = await execItem(payload)
        setRetrying(0)
        return out
      } catch (e) {
        const msg = e?.message || ''
        const transient = /429|too many|5\d\d|timeout|network|fetch/i.test(msg)
        if (!transient || attempt >= 6) throw e
        attempt++
        setRetrying(attempt)
        // exponential backoff up to ~30s, then steady — keeps trying for a long time
        const wait = Math.min(4000 * Math.pow(1.7, attempt), 30000)
        const steps = Math.ceil(wait / 500)
        for (let s = 0; s < steps; s++) {
          if (cancelRef.current) return ''
          await sleep(500)
        }
      }
    }
    return ''
  }

  const stop = useCallback(() => {
    cancelRef.current = true
    setRunning(false)
    setCurrent(null)
  }, [])

  const run = useCallback(async () => {
    const flow = getFlow(flowId)
    if (!flow) return
    cancelRef.current = false
    setError('')
    setRunning(true)
    haptic('medium')

    // helper to read the freshest mission each step (so manual edits persist)
    const mission = () => getFlow(flowId)?.data || {}

    // mark mission as running
    updateFlowData(flowId, { ...mission(), status: 'running' })

    const objective = flow.objective

    try {
      // 1) Research items (fill findings)
      const research = mission().research || []
      for (let i = 0; i < research.length; i++) {
        if (cancelRef.current) return finishCancelled()
        const r = research[i]
        if (r.result) continue
        setCurrent({ kind: 'research', title: r.topic })
        const out = await execResilient({
          objective,
          item: { kind: 'research', title: r.topic, context: r.note },
          mission: mission(),
          model,
        })
        const m = mission()
        const next = (m.research || []).map((x, j) =>
          j === i ? { ...x, result: out, done: true } : x
        )
        updateFlowData(flowId, { ...m, research: next })
        await sleep(ITEM_DELAY_MS)
      }

      // 2) Documents (write full content)
      const docs = mission().documents || []
      for (let i = 0; i < docs.length; i++) {
        if (cancelRef.current) return finishCancelled()
        const d = docs[i]
        if (d.content) continue
        setCurrent({ kind: 'document', title: d.name })
        const out = await execResilient({
          objective,
          item: { kind: 'document', title: d.name, context: d.purpose },
          mission: mission(),
          model,
        })
        const m = mission()
        const next = (m.documents || []).map((x, j) =>
          j === i ? { ...x, content: out, done: true } : x
        )
        updateFlowData(flowId, { ...m, documents: next })
        await sleep(ITEM_DELAY_MS)
      }

      // 3) Tasks (priority order, skip already done)
      const tasksIndexed = (mission().tasks || []).map((t, i) => ({ t, i }))
      tasksIndexed.sort(
        (a, b) =>
          (PRIORITY_RANK[a.t.priority] ?? 1) - (PRIORITY_RANK[b.t.priority] ?? 1)
      )
      for (const { i } of tasksIndexed) {
        if (cancelRef.current) return finishCancelled()
        const t = mission().tasks[i]
        if (!t || t.status === 'done') continue
        setCurrent({ kind: 'task', title: t.title })
        // mark doing
        updateFlowData(flowId, {
          ...mission(),
          tasks: mission().tasks.map((x, j) => (j === i ? { ...x, status: 'doing' } : x)),
        })
        const out = await execResilient({
          objective,
          item: { kind: 'task', title: t.title },
          mission: mission(),
          model,
        })
        const m = mission()
        updateFlowData(flowId, {
          ...m,
          tasks: m.tasks.map((x, j) =>
            j === i ? { ...x, status: 'done', result: out } : x
          ),
        })
        await sleep(ITEM_DELAY_MS)
      }

      updateFlowData(flowId, { ...mission(), status: 'done' })
      haptic('success')
    } catch (e) {
      setError(e.message || 'Run failed.')
      updateFlowData(flowId, { ...mission(), status: 'review' })
    } finally {
      setRunning(false)
      setCurrent(null)
    }

    function finishCancelled() {
      updateFlowData(flowId, { ...mission(), status: 'review' })
      setRunning(false)
      setCurrent(null)
    }
  }, [flowId, model])

  return { run, stop, running, current, error, retrying }
}
