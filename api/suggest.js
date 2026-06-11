// POST /api/suggest  { messages, count? }  -> { suggestions: [{short, full}] }
// Generates context-aware reply suggestions based on the conversation.
// Returns 2-3 suggestions with a short display label and a full structured prompt.

import { requireAuth, setCORS, sendError, parseBody } from './_lib/auth.js'

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const SUGGEST_MODEL = 'meta/llama-3.1-8b-instruct'

const SYS = `You are a smart reply suggestion generator for an AI chat app called NRVS.
Given the conversation, suggest EXACTLY 3 follow-up messages the user might want to send next.

Rules:
- Each suggestion must have a "short" version (2-6 words, catchy, displayed as a chip) and a "full" version (a well-structured, detailed prompt that gives NRVS proper context).
- The "short" version is a punchy label like "Basic Japanese phrases" or "Calculate trip expenses".
- The "full" version is a complete, detailed prompt that a user would type if they had time. It should be 2-4 sentences, provide context from the conversation, and give NRVS clear instructions.
- Suggestions should be genuinely useful, diverse, and follow naturally from the conversation. Don't repeat the same angle.
- If the conversation was about a topic, suggest practical next steps, deeper dives, related angles, or creative applications.
- Do NOT suggest generic things like "Tell me more" or "Can you explain again?". Be specific and actionable.
- Return STRICT JSON: {"suggestions":[{"short":"...","full":"..."},{"short":"...","full":"..."},{"short":"...","full":"..."}]}
- Output ONLY the JSON, nothing else.`

export default async function handler(req, res) {
  try { await requireAuth(req) }
  catch (err) {
    if (err?.cors) { setCORS(res, req); res.statusCode = 204; res.end(); return }
    sendError(res, err.status || 401, err.body?.error || 'Unauthorized')
    return
  }
  if (req.method === 'OPTIONS') { setCORS(res, req); res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') {
    setCORS(res, req); res.statusCode = 405; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions: [] }))
    return
  }

  let body
  try { body = await parseBody(req) }
  catch (e) {
    setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions: [] }))
    return
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions: [] }))
    return
  }

  // Build a compact summary of the conversation
  const transcript = messages
    .slice(-10)
    .map((m) => `${m.role.toUpperCase()}: ${String(m.content || '').slice(0, 1500)}`)
    .join('\n')
    .slice(0, 6000)

  try {
    const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: SUGGEST_MODEL,
        temperature: 0.8,
        max_tokens: 600,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `Here is the conversation so far:\n\n${transcript}\n\nSuggest 3 follow-up messages the user might want to send next.` },
        ],
      }),
    })
    if (!r.ok) {
      setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ suggestions: [] }))
      return
    }
    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content || '{}'
    const parsed = parseSuggestions(content)
    setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions: parsed }))
  } catch {
    setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ suggestions: [] }))
  }
}

function parseSuggestions(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const obj = JSON.parse(match ? match[0] : text)
    if (Array.isArray(obj.suggestions)) {
      return obj.suggestions
        .filter((s) => s.short && s.full)
        .map((s) => ({ short: String(s.short).slice(0, 60), full: String(s.full).slice(0, 500) }))
        .slice(0, 3)
    }
  } catch { /* ignore */ }
  return []
}
