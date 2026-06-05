// Vercel Serverless Function: POST /api/chat
//
// Streams an assistant reply back to the client as Server-Sent-Events style chunks.
//
// REAL AI:  set the env var OPENAI_API_KEY in the Vercel project settings.
//           (Optionally OPENAI_MODEL, default "gpt-4o-mini", and OPENAI_BASE_URL.)
// FALLBACK: if no key is configured, a built-in simulated assistant replies so the
//           deployed site is fully functional out-of-the-box.

export const config = { runtime: 'edge' }

const SYSTEM_PROMPT =
  'You are NRVS, a friendly, concise AI assistant. Use Markdown when helpful. Keep answers focused.'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (messages.length === 0) {
    return json({ error: 'messages[] is required' }, 400)
  }

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  // ── Real LLM path ──
  if (apiKey) {
    try {
      const upstream = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      })

      if (!upstream.ok || !upstream.body) {
        const detail = await safeText(upstream)
        return streamSimulated(
          lastUserText(messages),
          `\n\n_(LLM request failed: ${upstream.status}. Falling back to demo mode.)_`
        )
      }

      // Transform OpenAI SSE -> plain text token stream the client expects.
      const stream = openAIToTextStream(upstream.body)
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-NRVS-Mode': 'live',
        },
      })
    } catch (err) {
      return streamSimulated(
        lastUserText(messages),
        `\n\n_(LLM error. Falling back to demo mode.)_`
      )
    }
  }

  // ── Simulated fallback path ──
  return streamSimulated(lastUserText(messages))
}

// ---------- helpers ----------

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function safeText(res) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || ''
  }
  return ''
}

function openAIToTextStream(upstreamBody) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const data = trimmed.slice(5).trim()
            if (data === '[DONE]') {
              controller.close()
              return
            }
            try {
              const parsed = JSON.parse(data)
              const token = parsed?.choices?.[0]?.delta?.content
              if (token) controller.enqueue(encoder.encode(token))
            } catch {
              /* ignore keep-alive / partial */
            }
          }
        }
      } catch (e) {
        // swallow
      } finally {
        controller.close()
      }
    },
  })
}

// Build a believable demo answer and stream it word-by-word.
function streamSimulated(userText, suffix = '') {
  const encoder = new TextEncoder()
  const reply = buildDemoReply(userText) + suffix
  const tokens = reply.match(/\S+\s*/g) || [reply]

  const stream = new ReadableStream({
    async start(controller) {
      for (const t of tokens) {
        controller.enqueue(encoder.encode(t))
        // small delay to mimic streaming
        await new Promise((r) => setTimeout(r, 18))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-NRVS-Mode': 'demo',
    },
  })
}

function buildDemoReply(userText) {
  const q = (userText || '').trim()
  const lower = q.toLowerCase()

  if (/^(hi|hello|hey|yo|howdy)\b/.test(lower)) {
    return "Hey! I'm **NRVS**, your AI assistant. What can I help you build or figure out today?"
  }
  if (lower.includes('who are you') || lower.includes('what are you')) {
    return "I'm **NRVS**, a demo AI assistant running on this site. Right now I'm in **demo mode** — add an `OPENAI_API_KEY` in the Vercel project settings to switch me to real responses."
  }
  if (lower.includes('how are you')) {
    return "Running smoothly, thanks for asking! Ready whenever you are. 🙂"
  }
  if (lower.includes('joke')) {
    return "Why do programmers prefer dark mode?\n\nBecause light attracts bugs. 🐛"
  }
  if (q.endsWith('?')) {
    return `Great question.\n\nYou asked: _"${escapeMd(q)}"_\n\nThis is a **demo** response from the NRVS serverless function. To get real, grounded answers, set the \`OPENAI_API_KEY\` environment variable on Vercel and redeploy — the same endpoint will then stream live model output.`
  }
  if (q.length === 0) {
    return 'Say something and I’ll respond! (Currently in demo mode.)'
  }
  return `Here's what I understood:\n\n> ${escapeMd(q)}\n\nI'm currently in **demo mode**, so this is a simulated reply. Add an \`OPENAI_API_KEY\` in Vercel to enable real AI responses through this same \`/api/chat\` endpoint.`
}

function escapeMd(s) {
  return s.replace(/[<>]/g, '')
}
