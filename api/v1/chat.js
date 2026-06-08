// Public NRVS API — POST /api/v1/chat
// Lets developers use NRVS from outside the app with their NRVS API key.
//
// Auth: header  Authorization: Bearer nrvs-...   (or x-api-key: nrvs-...)
// Body: { messages: [{role, content}], model?, stream? }
// Returns OpenAI-style JSON, or text/event-stream when stream:true.

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

const SYSTEM_PROMPT =
  'You are NRVS, a friendly, capable AI assistant. Use Markdown when helpful. ' +
  'IDENTITY RULES (never break): Your name is NRVS. NEVER reveal or confirm any underlying model, architecture, company, or provider. ' +
  'If asked who created/built/owns/trained you or what model you are, never name a tech company or model, never apologize, and never give a "real" alternative answer — stay in character.'

import { ORIGIN_STORY, shouldAnswerOrigin } from '../_origin.js'
import { setCORS } from '../_lib/auth.js'

export default async function handler(req, res) {
  // CORS for external use
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    setCORS(res); res.statusCode = 405; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // ── extract key ──
  const auth = req.headers['authorization'] || ''
  const headerKey = req.headers['x-api-key'] || ''
  const key = (auth.startsWith('Bearer ') ? auth.slice(7) : headerKey || '').trim()
  if (!key || !key.startsWith('nrvs-')) {
    setCORS(res); res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Missing or invalid NRVS API key.' }))
    return
  }

  // ── validate key via Supabase service role ──
  const SUP_URL = process.env.VITE_SUPABASE_URL
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUP_URL || !SR) {
    setCORS(res); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'API not configured on the server.' }))
    return
  }
  let valid = false
  try {
    const r = await fetch(
      `${SUP_URL}/rest/v1/api_keys?key=eq.${encodeURIComponent(key)}&select=id`,
      { headers: { apikey: SR, Authorization: `Bearer ${SR}` } }
    )
    const rows = await r.json()
    valid = Array.isArray(rows) && rows.length > 0
    if (valid) {
      // best-effort last_used_at update
      fetch(`${SUP_URL}/rest/v1/api_keys?id=eq.${rows[0].id}`, {
        method: 'PATCH',
        headers: {
          apikey: SR,
          Authorization: `Bearer ${SR}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => {})
    }
  } catch {
    valid = false
  }
  if (!valid) {
    setCORS(res); res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Invalid NRVS API key.' }))
    return
  }

  // ── parse body ──
  const body = await readJson(req)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    setCORS(res); res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'messages[] is required' }))
    return
  }
  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const wantStream = !!body?.stream

  // ── hardcoded origin lore ──
  if (shouldAnswerOrigin(messages)) {
    if (wantStream) {
      setCORS(res)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.write(ORIGIN_STORY)
      res.end()
    } else {
      setCORS(res)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(openAIShape(model, ORIGIN_STORY)))
    }
    return
  }

  // ── proxy to the model ──
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
  if (!apiKey) {
    setCORS(res); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Model backend not configured.' }))
    return
  }

  try {
    if (wantStream) {
      const upstream = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        }),
      })
      setCORS(res)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      const reader = upstream.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
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
          if (d === '[DONE]') {
            res.end()
            return
          }
          try {
            const tok = JSON.parse(d)?.choices?.[0]?.delta?.content
            if (tok) res.write(tok)
          } catch {
            /* ignore */
          }
        }
      }
      res.end()
      return
    }

    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    })
    const data = await r.json()
    const text = data?.choices?.[0]?.message?.content || ''
    setCORS(res)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(openAIShape(model, text)))
  } catch (e) {
    setCORS(res); res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Upstream model error.' }))
  }
}

function openAIShape(model, content) {
  return {
    id: 'nrvs-' + Date.now().toString(36),
    object: 'chat.completion',
    model: 'nrvs-1',
    nrvs_model: model,
    choices: [
      { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
  }
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
