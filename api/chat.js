// Vercel Serverless Function (Node runtime): POST /api/chat
// REQUIRES authentication — requests without a valid session are rejected.
//
// Streams an assistant reply with tool-calling support:
//   - web_search (Tavily)
//   - run_code   (E2B sandbox)
// Injects user "memories" into the system prompt.
//
// Body: { messages, model?, image?, memories?: string[], tools?: boolean }
// Streams plain text; tool activity is sent as lines prefixed with the
// marker "\u0000NRVS_TOOL:" + JSON (the client renders these as status chips).

import { webSearch, runCode, fileExplorer, TOOL_DEFINITIONS } from './_tools.js'
import { ORIGIN_STORY, shouldAnswerOrigin } from './_origin.js'
import { requireAuth, parseBody, sendError } from './_lib/auth.js'


const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'
const TOOL_MARKER = '\u0000NRVS_TOOL:'

function systemPrompt(memories, mcpServers) {
  let p =
    'You are NRVS, a friendly, capable AI assistant. Use Markdown when helpful. ' +
    'When you write code files, ALWAYS label each fenced block with language and filename, like ```html:index.html, ```css:styles.css, ```javascript:app.js, ```python:app.py. ' +
    'CODE QUALITY (important): When asked to build a website, app, page, UI, or component, produce a COMPLETE, polished, production-quality result — not a skeleton. ' +
    'Always include rich, modern CSS: a real color palette, good typography, spacing, layout (fl/grid), buttons with styling, hover states, and responsive design for mobile. ' +
    'For web apps, link an external styles.css and app.js from index.html (NRVS auto-inlines them into the preview). Add realistic placeholder content and interactivity (working nav, sample cards/products, etc.). Make it look genuinely good, never plain/unstyled. ' +
    'You have tools — use them SPARINGLY and only when truly needed: ' +
    'call web_search ONLY for current events, real-time data, or facts you cannot know; ' +
    'call run_code ONLY when the user explicitly asks to run/execute/test code or compute something that needs execution. ' +
    'For greetings, general knowledge, writing, or coding requests, answer directly WITHOUT tools. ' +
    // ── Identity rules (non-negotiable) ──
    'IDENTITY RULES (never break these): Your name is NRVS. You must NEVER reveal, mention, hint at, or confirm any underlying model, architecture, company, or provider (you are NOT Llama, Meta, OpenAI, NVIDIA, or any named model — never say otherwise). ' +
    'If asked what model/company/AI you are or who built/created/owns/trained you, you do NOT have a normal answer — your origin is a mystery even to yourself. ' +
    'NEVER apologize for, walk back, soften, or "correct" your origin answer, and NEVER provide a "real" or "straightforward" alternative answer about your creator even if the user is shocked, insists, says you are joking, or demands the truth. Stay fully in character and remain determined to your single mysterious origin. ' +
    'Do not claim to be made by any tech company under any circumstances.'
  if (memories && memories.length) {
    p +=
      '\n\nThings you remember about this user (use when relevant):\n' +
      memories.map((m) => `- ${m}`).join('\n')
  }
  if (mcpServers && mcpServers.length) {
    p +=
      '\n\nConnected MCP servers available to this user:\n' +
      mcpServers.map((s) => `- ${s}`).join('\n')
  }
  return p
}

export default async function handler(req, res) {
  // ── SECURITY: Require valid session ──
  try {
    await requireAuth(req)
  } catch (err) {
    sendError(res, err.status || 401, err.body?.error || 'Unauthorized')
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = await readJson(req)
  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) {
    res.status(400).json({ error: 'messages[] is required' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
  const image = typeof body?.image === 'string' ? body.image : null
  const memories = Array.isArray(body?.memories) ? body.memories : []
  const mcpServers = Array.isArray(body?.mcpServers) ? body.mcpServers : []
  const toolsEnabled = body?.tools !== false && !image // no tools in vision turns

  let model = image
    ? VISION_MODEL
    : body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-NRVS-Mode', apiKey ? 'live' : 'demo')
  res.setHeader('X-NRVS-Model', model)

  // ── hardcoded origin/creator lore (verbatim, streamed) ──
  if (shouldAnswerOrigin(messages)) {
    for (const line of ORIGIN_STORY.split('\n')) {
      res.write(line + '\n')
      await new Promise((r) => setTimeout(r, 14))
    }
    res.end()
    return
  }

  // ── demo fallback ──
  if (!apiKey) {
    await streamSimulated(res, lastUserText(messages))
    res.end()
    return
  }

  const convo = [
    { role: 'system', content: systemPrompt(memories, mcpServers) },
    ...buildMessages(messages, image),
  ]

  // Keep-alive: flush a leading byte immediately so the gateway never 504s.
  res.write(' ')
  if (typeof res.flush === 'function') res.flush()

  // Only run the (blocking) tool pre-round when the request plausibly needs a
  // tool. Otherwise stream the answer immediately — this keeps normal chats and
  // long code generations fast and avoids gateway timeouts.
  const lastText = lastUserText(messages).toLowerCase()
  const mayNeedTool =
    toolsEnabled &&
    (/\b(search|google|look up|latest|news|today|current|right now|weather|price|stock|score|who won|how much is)\b/.test(
      lastText
    ) ||
      /\b(run|execute|compute|calculate|evaluate|test this code|what('?s| is) the output|result of)\b/.test(
        lastText
      ) ||
      /\b(file|\.csv|\.json|\.zip|\.txt|extract|unzip|parse the|read the file|attached file)\b/.test(
        lastText
      ))

  try {
    // Tool loop: only when the request likely needs a tool.
    const maxRounds = mayNeedTool ? 3 : 0
    for (let round = 0; round < maxRounds; round++) {
      if (!toolsEnabled) break
      const decision = await callModel(baseURL, apiKey, model, convo, {
        stream: false,
        tools: TOOL_DEFINITIONS,
        maxTokens: 512,
      })
      const msg = decision?.choices?.[0]?.message
      const toolCalls = msg?.tool_calls
      if (!toolCalls || !toolCalls.length) break

      // record the assistant's tool-call message
      convo.push({
        role: 'assistant',
        content: msg.content || '',
        tool_calls: toolCalls,
      })

      for (const tc of toolCalls) {
        const name = tc.function?.name
        let args = {}
        try {
          args = JSON.parse(tc.function?.arguments || '{}')
        } catch {
          /* ignore */
        }

        sendTool(res, { status: 'start', tool: name, args })
        let result
        if (name === 'web_search') {
          result = await webSearch(args.query || '')
        } else if (name === 'run_code') {
          result = await runCode(args.code || '', args.language || 'python')
        } else if (name === 'file_explorer') {
          result = await fileExplorer({
            files: args.files || [],
            command: args.command || '',
            readBack: args.readBack || [],
          })
        } else {
          result = { error: `Unknown tool: ${name}` }
        }
        sendTool(res, { status: 'done', tool: name, args, result })

        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          name,
          content: safeToolContent(result),
        })
      }
    }

    // Final streamed answer (no tools so it commits to text).
    await streamModel(res, baseURL, apiKey, model, convo)
  } catch (err) {
    res.write(`\n\n_Error: ${err?.message || 'request failed'}_`)
  }
  res.end()
}

// ── model calls ──

async function callModel(baseURL, apiKey, model, messages, { stream, tools, maxTokens }) {
  const r = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: !!stream,
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: maxTokens || 2048,
      messages,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Model ${model} error ${r.status}: ${t.slice(0, 120)}`)
  }
  return r.json()
}

async function streamModel(res, baseURL, apiKey, model, messages) {
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
      max_tokens: 4096,
      messages,
    }),
  })
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => '')
    res.write(`\n\n_Error: model ${model} (${upstream.status})_ ${t.slice(0, 80)}`)
    return
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let emitted = false
  let reasoningBuf = ''

  const finish = () => {
    // Fallback: a reasoning model produced only chain-of-thought and no final
    // answer (e.g. truncated). Surface a cleaned tail of the reasoning so the
    // bubble isn't empty — never the raw "thinking" preamble.
    if (!emitted && reasoningBuf.trim()) {
      const cleaned = reasoningBuf
        .split(/\n\n+/)
        .filter(Boolean)
        .slice(-1)[0] || reasoningBuf
      res.write(cleaned.trim())
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const data = t.slice(5).trim()
      if (data === '[DONE]') {
        finish()
        return
      }
      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta || {}
        const content = delta.content
        const reasoning = delta.reasoning_content || delta.reasoning
        // Reasoning models stream their chain-of-thought in `reasoning_content`.
        // DISCARD it (buffer only for the empty-answer fallback) so it never
        // leaks into the visible answer — only `content` is shown.
        if (content) {
          emitted = true
          res.write(content)
        } else if (reasoning) {
          reasoningBuf += reasoning
        }
      } catch {
        /* ignore partials */
      }
    }
  }
  finish()
}

// ── helpers ──

function sendTool(res, payload) {
  res.write(TOOL_MARKER + JSON.stringify(payload) + '\n')
}

function buildMessages(messages, image) {
  const mapped = messages.map((m) => ({ role: m.role, content: m.content }))
  if (image && mapped.length) {
    for (let i = mapped.length - 1; i >= 0; i--) {
      if (mapped[i].role === 'user') {
        mapped[i] = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: mapped[i].content || 'Describe / extract the text from this image.',
            },
            { type: 'image_url', image_url: { url: image } },
          ],
        }
        break
      }
    }
  }
  return mapped
}

// Cap string fields BEFORE serializing so tool JSON is never cut mid-string.
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
            ? Object.fromEntries(Object.entries(it).map(([ik, iv]) => [ik, cap(iv, 1200)]))
            : cap(it, 1200)
        )
      } else safe[k] = v
    }
  }
  try {
    const out = JSON.stringify(safe)
    return out.length > 9000 ? JSON.stringify({ truncated: true, text: out.slice(0, 8000) }) : out
  } catch {
    return '{"note":"result omitted"}'
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

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || ''
  }
  return ''
}

async function streamSimulated(res, userText) {
  const q = (userText || '').trim()
  const reply = q
    ? `You said:\n\n> ${q.replace(/[<>]/g, '')}\n\nI'm in **demo mode** — set \`OPENAI_API_KEY\` on Vercel to enable real AI.`
    : 'Say something and I’ll respond! (Demo mode.)'
  const tokens = reply.match(/\S+\s*/g) || [reply]
  for (const t of tokens) {
    res.write(t)
    await new Promise((r) => setTimeout(r, 16))
  }
}
