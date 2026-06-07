// POST /api/flow  { objective, model? }  ->  structured mission JSON
// Flow State Mode: turns an objective into a full "mission control" workspace.

export const config = { maxDuration: 60 }

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
  if (!objective) {
    res.status(400).json({ error: 'objective is required' })
    return
  }
  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE

  try {
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        max_tokens: 2200,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: `OBJECTIVE: ${objective}` },
        ],
      }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      res.status(502).json({ error: `Model error ${r.status}: ${t.slice(0, 120)}` })
      return
    }
    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const mission = parseMission(content, objective)
    res.status(200).json({ mission })
  } catch (e) {
    res.status(502).json({ error: 'Could not generate the mission.' })
  }
}

function parseMission(text, objective) {
  let obj = null
  try {
    const m = text.match(/\{[\s\S]*\}/)
    obj = JSON.parse(m ? m[0] : text)
  } catch {
    obj = {}
  }
  const arr = (x) => (Array.isArray(x) ? x : [])
  return {
    title: obj.title || objective.slice(0, 60),
    summary: obj.summary || '',
    roadmap: arr(obj.roadmap),
    tasks: arr(obj.tasks).map((t) => ({
      title: t.title || String(t),
      status: t.status === 'done' || t.status === 'doing' ? t.status : 'todo',
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
    })),
    research: arr(obj.research),
    documents: arr(obj.documents),
    timeline: arr(obj.timeline),
    metrics: arr(obj.metrics),
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
