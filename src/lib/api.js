// Client for the /api/* streaming endpoints.
// All requests carry the Supabase session token so the server can verify
// the user's identity and reject unauthenticated requests.

import { supabase } from './supabase'

const TOOL_MARKER = '\u0000NRVS_TOOL:'

// ── Internal: get the current Supabase session token ──
async function getAuthHeader() {
  const { data } = await supabase?.auth.getSession()
  const token = data?.session?.access_token
  return token ? `Bearer ${token}` : null
}

// ── Internal: make a streaming fetch with auth header ──
async function streamFetch(url, body, { onToken, onTool, signal } = {}) {
  const authHeader = await getAuthHeader()
  const headers = { 'Content-Type': 'application/json' }
  if (authHeader) headers['Authorization'] = authHeader

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = ''
    try { detail = (await res.json())?.error || '' } catch { /* ignore */ }
    throw new Error(detail || `Request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      if (line.startsWith(TOOL_MARKER)) {
        try { onTool?.(JSON.parse(line.slice(TOOL_MARKER.length))) } catch { /* ignore */ }
        buffer = buffer.slice(nl + 1)
      } else {
        const chunk = buffer.slice(0, nl + 1)
        onToken?.(chunk)
        buffer = buffer.slice(nl + 1)
      }
    }
    if (buffer && buffer[0] !== '\u0000') {
      onToken?.(buffer)
      buffer = ''
    }
  }
  if (buffer && buffer[0] !== '\u0000') onToken?.(buffer)
}

// ── Internal: non-streaming POST with auth header ──
async function jsonFetch(url, body) {
  const authHeader = await getAuthHeader()
  const headers = { 'Content-Type': 'application/json' }
  if (authHeader) headers['Authorization'] = authHeader

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  return res
}

// ── Chat: streaming with tool callbacks ──
export async function streamChat({ messages, model, image, memories, mcpServers, onToken, onTool, signal }) {
  let full = ''
  await streamFetch('/api/chat', { messages, model, image, memories, mcpServers }, {
    onToken: (chunk) => { full += chunk; onToken?.(chunk) },
    onTool,
    signal,
  })
  const mode = 'live' // server sets X-NRVS-Mode header
  return { text: full, mode }
}

// ── Chat: non-streaming (voice mode) ──
export async function chatOnce({ messages, model, memories }) {
  const res = await jsonFetch('/api/chat', { messages, model, memories, tools: false })
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
  }
  return full
    .replace(/\u0000NRVS_TOOL:[^\n]*\n?/g, '')
    .replace(/_Thinking:[\s\S]*?_/g, '')
    .trim()
}

// ── Website generation: streaming ──
export async function generateSite({ prompt, googleKey, model, onToken, signal }) {
  let full = ''
  await streamFetch('/api/site', { prompt, googleKey, model }, {
    onToken: (chunk) => { full += chunk; onToken?.(full) },
    signal,
  })
  let brief = ''
  const bm = full.match(/__NRVS_BRIEF__([\s\S]*?)__END_BRIEF__/)
  if (bm) brief = bm[1].trim()
  let source = 'native'
  const sm = full.match(/__NRVS_SOURCE__(\w+)/)
  if (sm) source = sm[1]
  const code = full
    .replace(/^[\s\S]*?__END_BRIEF__\n?/, '')
    .replace(/__NRVS_SOURCE__\w+\n?/, '')
    .replace(/^\s+/, '')
  return { text: code, source, brief }
}

// ── Run code in E2B sandbox ──
export async function runCodeRemote(code, language) {
  const res = await jsonFetch('/api/run', { code, language })
  return res.json()
}

// ── Extract memories from transcript ──
export async function extractMemories(messages) {
  try {
    const res = await jsonFetch('/api/memory-extract', { messages })
    const data = await res.json()
    return Array.isArray(data?.facts) ? data.facts : []
  } catch {
    return []
  }
}

// ── Serve artifact (E2B sandbox for fullstack preview) ──
export async function serveArtifact(files) {
  const res = await jsonFetch('/api/serve', { files })
  return res.json()
}