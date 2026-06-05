// Vercel Edge Function: POST /api/chat
//
// Streams an assistant reply. Designed for NVIDIA's OpenAI-compatible API
// (https://integrate.api.nvidia.com/v1) but works with any OpenAI-compatible endpoint.
//
// Env vars (set in Vercel → Settings → Environment Variables):
//   OPENAI_API_KEY   (required for live mode)  e.g. nvapi-...
//   OPENAI_BASE_URL  default https://integrate.api.nvidia.com/v1
//   OPENAI_MODEL     fallback default model id
//
// Request body: { messages: [{role, content}], model?: string, image?: dataURL }
// If no key is configured, a built-in simulated assistant replies so the site still works.

export const config = { runtime: 'edge' }

const SYSTEM_PROMPT =
  'You are NRVS, a friendly, concise AI assistant. Use Markdown when helpful. Keep answers focused and clear.'

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (messages.length === 0) return json({ error: 'messages[] is required' }, 400)

  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
  const image = typeof body?.image === 'string' ? body.image : null

  // Pick model: image -> vision model; else requested model -> env default -> hardcoded default.
  let model = image
    ? VISION_MODEL
    : body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  // ── Simulated fallback (no key) ──
  if (!apiKey) return streamSimulated(lastUserText(messages), '', model)

  // Build the outgoing messages. If an image is present, attach it to the last user turn
  // using the OpenAI vision content-array format.
  const outMessages = buildMessages(messages, image)

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
        temperature: 0.6,
        top_p: 0.95,
        max_tokens: 2048,
        messages: outMessages,
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const detail = (await safeText(upstream)).slice(0, 160)
      return streamSimulated(
        lastUserText(messages),
        `\n\n_(Model "${model}" unavailable: ${upstream.status}. Showing demo response.)_`,
        model
      )
    }

    return new Response(openAIToTextStream(upstream.body), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-NRVS-Mode': 'live',
        'X-NRVS-Model': model,
      },
    })
  } catch (err) {
    return streamSimulated(
      lastUserText(messages),
      `\n\n_(Network error reaching the model. Showing demo response.)_`,
      model
    )
  }
}

// ---------- message building ----------

function buildMessages(messages, image) {
  const mapped = messages.map((m) => ({ role: m.role, content: m.content }))
  if (image && mapped.length) {
    // attach image to the last user message
    for (let i = mapped.length - 1; i >= 0; i--) {
      if (mapped[i].role === 'user') {
        mapped[i] = {
          role: 'user',
          content: [
            { type: 'text', text: mapped[i].content || 'Describe / extract the text from this image.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        }
        break
      }
    }
  }
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...mapped]
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

// Transform upstream OpenAI/NVIDIA SSE into a plain text stream.
// Handles both `delta.content` and reasoning models' `delta.reasoning_content`.
function openAIToTextStream(upstreamBody) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let emittedContent = false
  let inThink = false

  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader()
      const push = (s) => controller.enqueue(encoder.encode(s))
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
              if (inThink) push('\n\n')
              controller.close()
              return
            }
            try {
              const parsed = JSON.parse(data)
              const delta = parsed?.choices?.[0]?.delta || {}
              const content = delta.content
              const reasoning = delta.reasoning_content || delta.reasoning

              if (content) {
                if (inThink) {
                  push('_\n\n')
                  inThink = false
                }
                emittedContent = true
                push(content)
              } else if (reasoning && !emittedContent) {
                // surface reasoning as subtle italic "thinking" so reasoning-only
                // models still show output.
                if (!inThink) {
                  push('_Thinking: ')
                  inThink = true
                }
                push(reasoning)
              }
            } catch {
              /* ignore keep-alive / partial chunk */
            }
          }
        }
        if (inThink) push('_')
      } catch {
        /* swallow */
      } finally {
        controller.close()
      }
    },
  })
}

// Demo answer streamed word-by-word.
function streamSimulated(userText, suffix = '', model = '') {
  const encoder = new TextEncoder()
  const reply = buildDemoReply(userText) + suffix
  const tokens = reply.match(/\S+\s*/g) || [reply]

  const stream = new ReadableStream({
    async start(controller) {
      for (const t of tokens) {
        controller.enqueue(encoder.encode(t))
        await new Promise((r) => setTimeout(r, 16))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-NRVS-Mode': 'demo',
      'X-NRVS-Model': model,
    },
  })
}

function buildDemoReply(userText) {
  const q = (userText || '').trim()
  const lower = q.toLowerCase()
  if (/^(hi|hello|hey|yo|howdy)\b/.test(lower)) {
    return "Hey! I'm **NRVS**. What can I help you with today?"
  }
  if (lower.includes('who are you') || lower.includes('what are you')) {
    return "I'm **NRVS**, an AI assistant. I'm currently in **demo mode** — add an `OPENAI_API_KEY` (your NVIDIA `nvapi-…` key) in the Vercel project settings to enable real responses."
  }
  if (q.endsWith('?')) {
    return `Good question — you asked: _"${escapeMd(q)}"_\n\nThis is a **demo** response. Set \`OPENAI_API_KEY\` on Vercel to stream live NVIDIA model output through this same endpoint.`
  }
  if (!q) return 'Say something and I’ll respond! (Demo mode.)'
  return `You said:\n\n> ${escapeMd(q)}\n\nI'm in **demo mode** right now. Add your NVIDIA API key in Vercel to enable real AI replies.`
}

function escapeMd(s) {
  return s.replace(/[<>]/g, '')
}
