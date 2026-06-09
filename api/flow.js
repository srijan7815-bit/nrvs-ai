// POST /api/flow  { objective, model? }  ->  structured mission JSON
// Flow State Mode: turns an objective into a full "mission control" workspace.
// REQUIRES authentication — requests without a valid session are rejected.

export const config = { maxDuration: 60 }

import { requireAuth, setCORS, sendError } from './_lib/auth.js'

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

const SYS = `You are NRVS in FLOW STATE MODE — a mission-control planner.
Given a user's OBJECTIVE, design a complete, actionable workspace to achieve it.

Return STRICT JSON ONLY (no markdown, no prose) with EXACTLY this shape:
{
  "title": "short mission title",
  "summary": "1-2 sentence mission overview",
  "roadmap": [ { "phase": "Phase name", "goal": "what this phase achieves" } ],
  "tasks": [ { "title": "task", "status": "todo", "priority": "high|medium|low" } ],
  "research": [ { "topic": "what to research", "note": "why / key question" } ],
  "documents": [ { "name": "doc name", "purpose": "what it contains" } ],
  "timeline": [ { "when": "Week 1 / Day 1 etc", "milestone": "milestone" } ],
  "metrics": [ { "name": "metric/KPI", "target": "target value" } ]
}

Rules:
- 4-5 roadmap phases, 8-12 concrete tasks (mix of priorities, all status "todo"),
  4-6 research items, 3-5 documents, 4-6 timeline milestones, 3-4 metrics.
- Keep each text value concise (one line). Be specific and tailored, not generic.
- Output ONLY the compact JSON object, no extra whitespace, no markdown.`

export default async function handler(req, res) {
  // ── SECURITY: Require valid session ──
  try {
    await requireAuth(req)
  } catch (err) {
    if (err?.cors) { setCORS(res); res.statusCode = 204; res.end(); return }
    sendError(res, err.status || 401, err.body?.error || 'Unauthorized')
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    sendError(res, 503, 'Model backend not configured.')
    return
  }

  const body = await readJson(req).catch(() => ({}))
  const objective = (body?.objective || '').trim()
  if (!objective) {
    sendError(res, 400, 'objective is required')
    return
  }

  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE

  setCORS(res)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.write(' ') // immediate keep-alive byte
  if (typeof res.flush === 'function') res.flush()

  try {
    const upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, stream: true, temperature: 0.6, max_tokens: 2200,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `OBJECTIVE: ${objective}` },
        ],
      }),
    })
    if (!upstream.ok || !upstream.body) {
      setCORS(res); res.write('\n__NRVS_FLOW_ERROR__'); res.end(); return
    }
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const d = t.slice(5).trim()
        if (d === '[DONE]') continue
        try {
          const tok = JSON.parse(d)?.choices?.[0]?.delta?.content
          if (tok) { res.write(tok); if (typeof res.flush === 'function') res.flush() }
        } catch { /* ignore */ }
      }
    }
    res.end()
  } catch (e) {
    setCORS(res); res.write('\n__NRVS_FLOW_ERROR__'); res.end()
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