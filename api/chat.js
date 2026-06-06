// Vercel Serverless Function (Node runtime): POST /api/chat
//
// Streams an assistant reply with tool-calling support:
//   - web_search (Tavily)
//   - run_code   (E2B sandbox)
// Injects user "memories" into the system prompt.
// Falls back to a simulated assistant if OPENAI_API_KEY is not set.
//
// Body: { messages, model?, image?, memories?: string[], tools?: boolean }
// Streams plain text; tool activity is sent as lines prefixed with the
// marker "\u0000NRVS_TOOL:" + JSON (the client renders these as status chips).

import { webSearch, runCode, TOOL_DEFINITIONS } from './_tools.js'


const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'
const TOOL_MARKER = '\u0000NRVS_TOOL:'

function systemPrompt(memories, mcpServers) {
  let p =
    'You are NRVS, a friendly, capable AI assistant. Use Markdown when helpful. ' +
    'When you write a code file, start the fenced block info string with the language and a filename, like ```python:app.py (and ```html:index.html for web apps). ' +
    'You have two tools but use them SPARINGLY and only when truly needed: ' +
    'call web_search ONLY for current events, real-time data, or facts you cannot know; ' +
    'call run_code ONLY when the user explicitly asks to run/execute/test code or compute something that needs execution. ' +
    'For greetings, general knowledge, writing, or coding requests, answer directly WITHOUT tools.'
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

  try {
    // Tool loop: up to 4 rounds of tool calls before final streamed answer.
    for (let round = 0; round < 4; round++) {
      if (!toolsEnabled) break
      const decision = await callModel(baseURL, apiKey, model, convo, {
        stream: false,
        tools: TOOL_DEFINITIONS,
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
        } else {
          result = { error: `Unknown tool: ${name}` }
        }
        sendTool(res, { status: 'done', tool: name, args, result })

        convo.push({
          role: 'tool',
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(result).slice(0, 6000),
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

async function callModel(baseURL, apiKey, model, messages, { stream, tools }) {
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
      max_tokens: 2048,
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
      max_tokens: 2048,
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
  let inThink = false

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
        if (inThink) res.write('_\n\n')
        return
      }
      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta || {}
        const content = delta.content
        const reasoning = delta.reasoning_content || delta.reasoning
        if (content) {
          if (inThink) {
            res.write('_\n\n')
            inThink = false
          }
          emitted = true
          res.write(content)
        } else if (reasoning && !emitted) {
          if (!inThink) {
            res.write('_Thinking: ')
            inThink = true
          }
          res.write(reasoning)
        }
      } catch {
        /* ignore partials */
      }
    }
  }
  if (inThink) res.write('_')
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
