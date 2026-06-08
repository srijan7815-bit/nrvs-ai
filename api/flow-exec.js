// POST /api/flow-exec  { objective, item:{kind,title,context}, mission? }
//   kind = 'task' | 'research' | 'document'
// Executes ONE plan item autonomously (with web_search / run_code tools) and
// returns the produced result text. Used by Flow State autonomous execution.

import { webSearch, runCode, fileExplorer, TOOL_DEFINITIONS } from './_tools.js'
import { requireAuth, parseBody, sendError } from './_lib/auth.js'

export const config = { maxDuration: 60 }

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

function sys(objective, mission) {
  let p =
    'You are NRVS executing a mission autonomously in Flow State. ' +
    `The overall objective is: "${objective}". ` +
    'You are given ONE work item to complete. Actually DO the work and produce a concrete, useful deliverable — ' +
    'not a plan or a description of what you would do. ' +
    'For a task: complete it and report the result. ' +
    'For research: find and synthesize real findings (use web_search for current/factual topics). ' +
    'For a document: write the FULL document content (well-structured Markdown). ' +
    'If code is needed, write it (use ```lang:filename fences) and you may run_code to verify. ' +
    'Use tools only when they genuinely help. Be thorough but focused. Output only the deliverable.'
  if (mission?.summary) p += `\n\nMission summary: ${mission.summary}`
  return p
}

export default async function handler(req, res) {
  try { await requireAuth(req) }
  catch (err) { sendError(res, err.status||401, err.body?.error||'Unauthorized'); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Model backend not configured.' })
    return
  }
  const body = await readJson(req)
  const objective = (body?.objective || '').trim()
  const item = body?.item || {}
  const mission = body?.mission || {}
  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE

  if (!item.title) {
    res.status(400).json({ error: 'item.title is required' })
    return
  }

  const userMsg =
    `WORK ITEM (${item.kind || 'task'}): ${item.title}` +
    (item.context ? `\nContext: ${item.context}` : '') +
    `\n\nComplete this now and return the deliverable.`

  const convo = [
    { role: 'system', content: sys(objective, mission) },
    { role: 'user', content: userMsg },
  ]

  try {
    // Up to 3 tool rounds, then a final answer.
    for (let round = 0; round < 3; round++) {
      const decision = await call(baseURL, apiKey, model, convo, {
        tools: TOOL_DEFINITIONS,
        maxTokens: 700,
      })
      const msg = decision?.choices?.[0]?.message
      const calls = msg?.tool_calls
      if (!calls || !calls.length) {
        // model answered directly
        if (msg?.content) {
          res.status(200).json({ result: msg.content })
          return
        }
        break
      }
      convo.push({ role: 'assistant', content: msg.content || '', tool_calls: calls })
      for (const tc of calls) {
        let args = {}
        try {
          args = JSON.parse(tc.function?.arguments || '{}')
        } catch {
          /* ignore */
        }
        let result
        const name = tc.function?.name
        if (name === 'web_search') result = await webSearch(args.query || '')
        else if (name === 'run_code') result = await runCode(args.code || '', args.language || 'python')
        else if (name === 'file_explorer') result = await fileExplorer(args)
        else result = { error: 'unknown tool' }
        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          name,
          // IMPORTANT: cap each string field BEFORE serializing, then serialize,
          // so the JSON is never cut mid-string (which caused model 400 errors).
          content: safeToolContent(result),
        })
      }
    }
    // final answer (no tools)
    const final = await call(baseURL, apiKey, model, convo, { maxTokens: 2048 })
    const text = final?.choices?.[0]?.message?.content || '_(No result produced.)_'
    res.status(200).json({ result: text })
  } catch (e) {
    res.status(502).json({ error: 'Execution failed: ' + (e?.message || 'unknown') })
  }
}

async function call(baseURL, apiKey, model, messages, { tools, maxTokens } = {}) {
  const body = JSON.stringify({
    model,
    temperature: 0.6,
    max_tokens: maxTokens || 2048,
    messages,
    ...(tools ? { tools, tool_choice: 'auto' } : {}),
  })
  // Retry with exponential backoff on rate limits / transient errors.
  let lastErr = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body,
    })
    if (r.ok) return r.json()
    const status = r.status
    lastErr = `model ${status}`
    // 429 (rate limit) or 5xx (transient) -> wait and retry
    if (status === 429 || status >= 500) {
      const retryAfter = parseFloat(r.headers.get('retry-after') || '0')
      const wait = retryAfter
        ? retryAfter * 1000
        : Math.min(1500 * Math.pow(2, attempt), 12000)
      await new Promise((res) => setTimeout(res, wait))
      continue
    }
    // non-retryable
    const t = await r.text().catch(() => '')
    throw new Error(`model ${status}: ${t.slice(0, 100)}`)
  }
  throw new Error(`${lastErr}: rate limited (retries exhausted)`)
}

// Build a tool result string that is ALWAYS valid (cap fields, not raw JSON).
function safeToolContent(result) {
  const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : s)
  let safe = result
  if (result && typeof result === 'object') {
    safe = {}
    for (const [k, v] of Object.entries(result)) {
      if (typeof v === 'string') safe[k] = cap(v, 3000)
      else if (Array.isArray(v)) {
        safe[k] = v.slice(0, 8).map((it) =>
          it && typeof it === 'object'
            ? Object.fromEntries(
                Object.entries(it).map(([ik, iv]) => [ik, cap(iv, 1200)])
              )
            : cap(it, 1200)
        )
      } else safe[k] = v
    }
  }
  let out = ''
  try {
    out = JSON.stringify(safe)
  } catch {
    return '{"note":"result omitted"}'
  }
  // If still too large, return a valid JSON object with a truncated text field.
  if (out.length > 9000) {
    return JSON.stringify({ truncated: true, text: out.slice(0, 8000) })
  }
  return out
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}
