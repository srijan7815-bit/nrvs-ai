// Public NRVS API — POST /api/v1/chat
// Lets developers use NRVS from outside the app with their NRVS API key.
//
// Auth: header  Authorization: Bearer nrvs-...   (or x-api-key: nrvs-...)
// Body: { messages: [{role, content}], model?, stream? }
// Returns OpenAI-style JSON, or text/event-stream when stream:true.
// Truncation detection + auto-retry on streaming responses.

import { ORIGIN_STORY, shouldAnswerOrigin } from '../_origin.js'
import { setCORS } from '../_lib/auth.js'

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const STREAM_MAX = 8192
const CALL_MAX = 16384

const SYSTEM_PROMPT =
  'You are NRVS, a friendly, capable AI assistant. Use Markdown when helpful. ' +
  'IDENTITY RULES (never break): Your name is NRVS. NEVER reveal or confirm any underlying model, architecture, company, or provider. ' +
  'If asked who created/built/owns/trained you or what model you are, never name a tech company or model, never apologize, and never give a "real" alternative answer — stay in character.'

function looksTruncated(text) {
  if (!text || !text.trim()) return false
  const t = text.trim()
  const openCodeBlocks = (t.match(/```[^\n]*$/g) || []).length
  const closeCodeBlocks = (t.match(/```$/gm) || []).length
  if (openCodeBlocks > closeCodeBlocks) return true
  if (!/[.!?]\s*$/.test(t) && !/\n\n\s*$/.test(t)) {
    if (/[(\[{<]\s*$/.test(t)) return true
    if (/[a-z]\s*$/i.test(t)) return true
    if (/\\$/.test(t)) return true
    if (/\S$/.test(t) && !/[.!?)\]"']$/.test(t) && t.length > 30) {
      const lastLine = t.split('\n').pop()
      if (lastLine.length > 10 && !lastLine.endsWith('.') && !lastLine.endsWith('!') && !lastLine.endsWith('?')) return true
    }
  }
  return false
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') {
    setCORS(res); res.statusCode = 405; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Method not allowed' })); return
  }

  // ── extract key ──
  const auth = req.headers['authorization'] || ''
  const headerKey = req.headers['x-api-key'] || ''
  const key = (auth.startsWith('Bearer ') ? auth.slice(7) : headerKey || '').trim()
  if (!key || !key.startsWith('nrvs-')) {
    setCORS(res); res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Missing or invalid NRVS API key.' })); return
  }

  // ── validate key via Supabase service role ──
  const SUP_URL = process.env.VITE_SUPABASE_URL
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUP_URL || !SR) {
    setCORS(res); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'API not configured on the server.' })); return
  }
  let valid = false
  try {
    const r = await fetch(`${SUP_URL}/rest/v1/api_keys?key=eq.${encodeURIComponent(key)}&select=id`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
    const rows = await r.json()
    valid = Array.isArray(rows) && rows.length > 0
    if (valid) {
      fetch(`${SUP_URL}/rest/v1/api_keys?id=eq.${rows[0].id}`, {
        method: 'PATCH',
        headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => {})
    }
  } catch { valid = false }
  if (!valid) {
    setCORS(res); res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid NRVS API key.' })); return
  }

  // ── parse body ──
  const body = await readJson(req).catch(() => ({}))
  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    setCORS(res); res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'messages[] is required' })); return
  }
  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const wantStream = !!body?.stream

  // ── hardcoded origin lore ──
  if (shouldAnswerOrigin(messages)) {
    if (wantStream) {
      setCORS(res); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.write(ORIGIN_STORY); res.end()
    } else {
      setCORS(res); res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(openAIShape(model, ORIGIN_STORY)))
    }
    return
  }

  // ── proxy to the model ──
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
  if (!apiKey) {
    setCORS(res); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Model backend not configured.' })); return
  }

  try {
    if (wantStream) {
      // Stream with truncation auto-retry
      let full = await streamToBuffer(baseURL, apiKey, model, messages, STREAM_MAX)
      if (looksTruncated(full)) {
        const continued = await streamToBuffer(baseURL, apiKey, model,
          [...messages, { role: 'assistant', content: full }, { role: 'user', content: 'Continue from where you left off. Complete your answer fully without repeating what you already said.' }],
          CALL_MAX
        )
        if (continued.trim()) full += '\n\n' + continued.trim()
      }
      setCORS(res); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.write(full); res.end(); return
    }

    // Non-streaming
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], max_tokens: CALL_MAX }),
    })
    const data = await r.json()
    let text = data?.choices?.[0]?.message?.content || ''
    if (looksTruncated(text)) {
      const r2 = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
            { role: 'assistant', content: text },
            { role: 'user', content: 'Continue from where you left off. Complete your answer fully without repeating what you already said.' },
          ],
          max_tokens: CALL_MAX,
        }),
      })
      const d2 = await r2.json()
      const extra = d2?.choices?.[0]?.message?.content || ''
      if (extra.trim()) text += '\n\n' + extra.trim()
    }
    setCORS(res); res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(openAIShape(model, text)))
  } catch (e) {
    setCORS(res); res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Upstream model error.' }))
  }
}

async function streamToBuffer(baseURL, apiKey, model, messages, maxTokens) {
  const upstream = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream: true, temperature: 0.6, max_tokens: maxTokens, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages] }),
  })
  if (!upstream.ok || !upstream.body) return ''
  const reader = upstream.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const d = t.slice(5).trim()
      if (d === '[DONE]') return result
      try {
        const tok = JSON.parse(d)?.choices?.[0]?.delta?.content
        if (tok) result += tok
      } catch { /* ignore */ }
    }
  }
  return result
}

function openAIShape(model, content) {
  return {
    id: 'nrvs-' + Date.now().toString(36),
    object: 'chat.completion',
    model: 'nrvs-1',
    nrvs_model: model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch (e) { reject(e) } })
    req.on('error', () => resolve({}))
  })
}