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
import { requireAuth, setCORS, sendError } from './_lib/auth.js'

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'
const TOOL_MARKER = '\u0000NRVS_TOOL:'
const REASONING_MARKER = '\u0001NRVS_THINK:' // sent to client for live thinking indicator
// Max tokens for streaming — generous to reduce truncation
const STREAM_MAX_TOKENS = 8192
// Max tokens for non-streaming calls
const CALL_MAX_TOKENS = 16384

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
    p += '\n\nThings you remember about this user (use when relevant):\n' + memories.map((m) => `- ${m}`).join('\n')
  }
  if (mcpServers && mcpServers.length) {
    p += '\n\nConnected MCP servers available to this user:\n' + mcpServers.map((s) => `- ${s}`).join('\n')
  }
  return p
}

/**
 * Returns true if text looks truncated.
 * Conservative — only flags genuinely broken structural endings.
 * Avoids false positives on normal complete text.
 */
function looksTruncated(text) {
  if (!text || !text.trim()) return false
  const t = text.trim()

  // Case 1: Open code block (``` with no closing)
  const openCode = (t.match(/```[^\n]*$/g) || []).length
  const closeCode = (t.match(/```$/gm) || []).length
  if (openCode > closeCode) return true

  // Case 2: Unclosed HTML/JSX tag
  if (/<[a-zA-Z][a-zA-Z0-9-]*\s*[^>]*$/.test(t)) return true
  if (/<[^>]*(?![a-zA-Z]|$)$/.test(t) && /<[a-zA-Z]/.test(t)) return true

  // Case 3: Unclosed braces in code context
  if (/\{[^}]*$/.test(t) && t.length > 200) return true

  // Case 4: Clearly cut off mid-word by token limit
  const lastWord = t.split(/\s/).pop()
  if (lastWord && lastWord.length > 1 && /[a-zA-Z]$/.test(lastWord)) {
    const lastLine = t.split(/\n/).pop()
    if (
      lastLine.length > 5 &&
      !/[.!?\)\]"']$/.test(lastLine) &&
      !lastLine.includes('.') &&
      lastWord.length > 3
    ) return true
  }

  return false
}

export default async function handler(req, res) {
  // ── SECURITY: Require valid session ──
  try {
    await requireAuth(req)
  } catch (err) {
    if (err?.cors) { setCORS(res, req); res.statusCode = 204; res.end(); return }
    sendError(res, err.status || 401, err.body?.error || 'Unauthorized')
    return
  }

  if (req.method !== 'POST') {
    setCORS(res, req); res.statusCode = 405; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Method not allowed' })); return
  }

  let body
  try { body = await readJson(req) }
  catch { sendError(res, 400, 'Invalid JSON body'); return }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) { sendError(res, 400, 'messages[] is required'); return }

  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE
  const image = typeof body?.image === 'string' ? body.image : null
  const memories = Array.isArray(body?.memories) ? body.memories : []
  const mcpServers = Array.isArray(body?.mcpServers) ? body.mcpServers : []
  const toolsEnabled = body?.tools !== false && !image

  const model = image ? VISION_MODEL : body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  setCORS(res, req)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-NRVS-Mode', apiKey ? 'live' : 'demo')
  res.setHeader('X-NRVS-Model', model)

  // ── hardcoded origin/creator lore ──
  if (shouldAnswerOrigin(messages)) {
    for (const line of ORIGIN_STORY.split('\n')) {
      res.write(line + '\n')
      await new Promise((r) => setTimeout(r, 14))
    }
    res.end(); return
  }

  // ── demo fallback ──
  if (!apiKey) {
    await streamSimulated(res, lastUserText(messages))
    res.end(); return
  }

  const convo = [
    { role: 'system', content: systemPrompt(memories, mcpServers) },
    ...buildMessages(messages, image),
  ]

  // Keep-alive: flush a leading byte immediately
  res.write(' ')
  if (typeof res.flush === 'function') res.flush()

  const lastText = lastUserText(messages).toLowerCase()
  const mayNeedTool =
    toolsEnabled &&
    (/\b(search|google|look up|latest|news|today|current|right now|weather|price|stock|score|who won|how much is)\b/.test(lastText) ||
      /\b(run|execute|compute|calculate|evaluate|test this code|what('?s| is) the output|result of)\b/.test(lastText) ||
      /\b(file|\.csv|\.json|\.zip|\.txt|extract|unzip|parse the|read the file|attached file)\b/.test(lastText))

  try {
    // Tool loop
    const maxRounds = mayNeedTool ? 3 : 0
    for (let round = 0; round < maxRounds; round++) {
      if (!toolsEnabled) break
      const decision = await callModel(baseURL, apiKey, model, convo, { stream: false, tools: TOOL_DEFINITIONS, maxTokens: 512 })
      const msg = decision?.choices?.[0]?.message
      const toolCalls = msg?.tool_calls
      if (!toolCalls || !toolCalls.length) break
      convo.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls })
      for (const tc of toolCalls) {
        const name = tc.function?.name
        let args = {}
        try { args = JSON.parse(tc.function?.arguments || '{}') } catch { /* ignore */ }
        sendTool(res, { status: 'start', tool: name, args })
        let result
        if (name === 'web_search') result = await webSearch(args.query || '')
        else if (name === 'run_code') result = await runCode(args.code || '', args.language || 'python')
        else if (name === 'file_explorer') result = await fileExplorer({ files: args.files || [], command: args.command || '', readBack: args.readBack || [] })
        else result = { error: `Unknown tool: ${name}` }
        sendTool(res, { status: 'done', tool: name, args, result })
        convo.push({ role: 'tool', tool_call_id: tc.id, name, content: safeToolContent(result) })
      }
    }

    // Final streamed answer with truncation auto-retry
    await streamModelWithRetry(res, baseURL, apiKey, model, convo)
  } catch (err) {
    setCORS(res, req); res.write(`\n\n_Error: ${err?.message || 'request failed'}_`)
  }
  res.end()
}

// ── streaming with auto-retry on truncation ──

async function streamModelWithRetry(res, baseURL, apiKey, model, messages) {
  let full = await streamToBuffer(res, baseURL, apiKey, model, messages, STREAM_MAX_TOKENS)
  if (!full.trim()) return

  // If truncated, continue once — targeted prompt that avoids repetition
  if (looksTruncated(full)) {
    const continued = await streamToBuffer(
      res, baseURL, apiKey, model,
      [...messages, { role: 'assistant', content: full }, { role: 'user', content: 'Continue directly from where your previous message ended. Do not repeat anything you already said. Write only the rest of the answer.' }],
      CALL_MAX_TOKENS
    )
    if (continued.trim()) full += '\n\n' + continued.trim()
  }
}

async function streamToBuffer(res, baseURL, apiKey, model, messages, maxTokens) {
  const upstream = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream: true, temperature: 0.6, top_p: 0.95, max_tokens: maxTokens, messages }),
  })
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => '')
    res.write(`\n\n_Error: model ${model} (${upstream.status})_ ${t.slice(0, 80)}`)
    return ''
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let emitted = false
  let reasoningBuf = ''
  let finalContent = ''
  let reasoningFlushed = 0 // bytes of reasoning already sent to client

  const finish = () => {
    // If the model only produced reasoning (no content), use the reasoning
    // as the final answer — but cap it to avoid dumping massive text.
    if (!emitted && reasoningBuf.trim()) {
      const cleaned = reasoningBuf.split(/\n\n+/).filter(Boolean).slice(-1)[0] || reasoningBuf
      const trimmed = cleaned.trim().slice(0, 4000)
      finalContent += trimmed
      res.write(trimmed)
      emitted = true
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
      if (data === '[DONE]') { finish(); return finalContent }
      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta || {}
        const content = delta.content
        const reasoning = delta.reasoning_content || delta.reasoning
        if (content) {
          emitted = true
          finalContent += content
          res.write(content)
        } else if (reasoning) {
          reasoningBuf += reasoning
          // Stream reasoning to client incrementally so the UI stays responsive.
          // Send in batches (~64 chars) to avoid flooding with per-token writes.
          const pending = reasoningBuf.length - reasoningFlushed
          if (pending >= 64) {
            const chunk = reasoningBuf.slice(reasoningFlushed)
            reasoningFlushed = reasoningBuf.length
            res.write(REASONING_MARKER + JSON.stringify({ text: chunk }) + '\n')
            if (typeof res.flush === 'function') res.flush()
          }
        }
      } catch { /* ignore partials */ }
    }
  }
  // Flush any remaining reasoning
  if (!emitted && reasoningBuf.length > reasoningFlushed) {
    const remaining = reasoningBuf.slice(reasoningFlushed).trim().slice(0, 4000)
    if (remaining) {
      res.write(REASONING_MARKER + JSON.stringify({ text: remaining, done: true }) + '\n')
    }
  }
  finish()
  return finalContent
}

// ── model calls ──

async function callModel(baseURL, apiKey, model, messages, { stream, tools, maxTokens }) {
  const r = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream: !!stream, temperature: 0.6, top_p: 0.95, max_tokens: maxTokens || CALL_MAX_TOKENS, messages, ...(tools ? { tools, tool_choice: 'auto' } : {}) }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Model ${model} error ${r.status}: ${t.slice(0, 120)}`)
  }
  return r.json()
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
            { type: 'text', text: mapped[i].content || 'Describe / extract the text from this image.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        }
        break
      }
    }
  }
  return mapped
}

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

function readJson(req, maxBytes) {
  maxBytes = maxBytes || 512 * 1024
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) { reject(new Error('Body too large')); return }
      data += c
    })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch (e) { reject(e) } })
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
    : 'Say something and I\'ll respond! (Demo mode.)'
  const tokens = reply.match(/\S+\s*/g) || [reply]
  for (const t of tokens) {
    res.write(t)
    await new Promise((r) => setTimeout(r, 16))
  }
}