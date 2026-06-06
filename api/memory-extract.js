// POST /api/memory-extract  { messages }  -> { facts: string[] }
// NRVS auto-extracts durable, useful facts about the user worth remembering.
// Returns [] when nothing notable. Uses a fast model + strict JSON instruction.

export const config = { runtime: 'nodejs' }

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const EXTRACT_MODEL = 'meta/llama-3.1-8b-instruct'

const SYS = `You extract durable facts about the USER worth remembering long-term across conversations.
Only capture stable, personal, useful facts: name, preferences, goals, profession, tools they use, ongoing projects, constraints.
DO NOT capture: one-off questions, transient context, sensitive data (passwords, full card numbers), or assistant statements.
Return STRICT JSON only: {"facts": ["fact 1", "fact 2"]}. If nothing worth saving, return {"facts": []}.
Keep each fact short (max ~12 words), written in third person ("User prefers ...").`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(200).json({ facts: [] })
    return
  }
  const body = await readJson(req)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const transcript = messages
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 4000)
  if (!transcript.trim()) {
    res.status(200).json({ facts: [] })
    return
  }

  try {
    const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
    const r = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: transcript },
        ],
      }),
    })
    if (!r.ok) {
      res.status(200).json({ facts: [] })
      return
    }
    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content || '{}'
    const facts = parseFacts(content)
    res.status(200).json({ facts })
  } catch {
    res.status(200).json({ facts: [] })
  }
}

function parseFacts(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const obj = JSON.parse(match ? match[0] : text)
    if (Array.isArray(obj.facts)) {
      return obj.facts
        .filter((f) => typeof f === 'string' && f.trim())
        .map((f) => f.trim())
        .slice(0, 5)
    }
  } catch {
    /* ignore */
  }
  return []
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
