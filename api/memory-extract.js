// POST /api/memory-extract  { messages }  -> { facts: string[] }
// NRVS auto-extracts durable, useful facts about the user worth remembering.
// Returns [] when nothing notable. Uses a fast model + strict JSON instruction.


const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const EXTRACT_MODEL = 'meta/llama-3.1-8b-instruct'

const SYS = `You decide whether a short conversation reveals an ENDURING fact about WHO THE USER IS that would help an assistant understand them as a person across future, unrelated conversations.

Capture ONLY stable, identity-level facts the user states about THEMSELVES, such as:
- their name or what they want to be called
- their profession / role / field of study
- a long-term, explicitly stated preference about how they like answers (tone, length, language)
- a durable personal trait, value, or constraint they state about themselves (e.g. "I'm a beginner", "I'm vegetarian", "I'm dyslexic")
- a stable long-term goal they explicitly state

Be EXTREMELY conservative. The default answer is NOTHING.

DO NOT capture:
- the topic, subject, or content of what they're currently asking about
- one-off tasks, questions, requests, or what they're working on right now
- temporary context, facts about the world, code, or anything the assistant said
- anything that wouldn't still be true and useful months from now
- vague or inferred traits — only explicit self-statements

If in doubt, return nothing. It is far better to save nothing than to save a chat topic.

Return STRICT JSON only: {"facts": ["..."]}. Empty when nothing qualifies: {"facts": []}.
Each fact: short (max ~10 words), third person, about the user ("User is a doctor.", "User prefers concise answers.").`

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
