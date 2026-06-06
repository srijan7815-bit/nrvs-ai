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
