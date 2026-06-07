// Client for the /api/chat streaming endpoint.
// Parses inline tool-activity markers and calls onTool / onToken accordingly.

const TOOL_MARKER = '\u0000NRVS_TOOL:'

export async function streamChat({
  messages,
  model,
  image,
  memories,
  mcpServers,
  onToken,
  onTool,
  signal,
}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, image, memories, mcpServers }),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = ''
    try {
      detail = (await res.json())?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }

  const mode = res.headers.get('X-NRVS-Mode') || 'demo'
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Extract any tool-marker lines; the rest is assistant text.
    let nl
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl)
      if (line.startsWith(TOOL_MARKER)) {
        try {
          onTool?.(JSON.parse(line.slice(TOOL_MARKER.length)))
        } catch {
          /* ignore */
        }
        buffer = buffer.slice(nl + 1)
      } else {
        // keep newline as content; flush line + newline
        const chunk = buffer.slice(0, nl + 1)
        full += chunk
        onToken?.(chunk)
        buffer = buffer.slice(nl + 1)
      }
    }
    // flush any partial that isn't a (potential) marker start
    if (buffer && !TOOL_MARKER.startsWith(buffer[0]) && buffer[0] !== '\u0000') {
      full += buffer
      onToken?.(buffer)
      buffer = ''
    }
  }
  if (buffer && !buffer.startsWith(TOOL_MARKER)) {
    full += buffer
    onToken?.(buffer)
  }

  return { text: full, mode }
}

// Non-streaming chat for Live (voice) mode: returns the full reply text.
// Tools are disabled for snappier voice turns.
export async function chatOnce({ messages, model, memories }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, memories, tools: false }),
  })
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
  }
  // strip any tool markers + the italic "thinking" wrapper for clean speech
  return full
    .replace(/\u0000NRVS_TOOL:[^\n]*\n?/g, '')
    .replace(/_Thinking:[\s\S]*?_/g, '')
    .trim()
}

// Generate a full website (FUISHAN when a Google key is given, else native NRVS).
// Streams; calls onToken with code chunks. Returns { text, source, brief }.
export async function generateSite({ prompt, googleKey, model, onToken, signal }) {
  const res = await fetch('/api/site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, googleKey, model }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('Site generation failed.')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onToken?.(full)
  }
  // parse out brief + source markers
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

// Boot a live server for a fullstack/backend artifact in an E2B sandbox.
export async function serveArtifact(files) {
  const res = await fetch('/api/serve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  return res.json()
}

// Run a code block in the E2B sandbox.
export async function runCodeRemote(code, language) {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  })
  return res.json()
}

// Ask the server to extract durable facts about the user from a transcript.
export async function extractMemories(messages) {
  try {
    const res = await fetch('/api/memory-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    const data = await res.json()
    return Array.isArray(data?.facts) ? data.facts : []
  } catch {
    return []
  }
}
