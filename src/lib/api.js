// Client for the /api/chat streaming endpoint.
// Calls onToken(chunk) as text streams in; resolves with the full text.

export async function streamChat({ messages, onToken, signal }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onToken?.(chunk)
  }

  return { text: full, mode }
}
