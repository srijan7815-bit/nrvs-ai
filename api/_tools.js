// Server-side tool implementations: web search (Tavily) + code execution (E2B).
// Used by /api/chat's tool-calling loop and by direct endpoints.
// The E2B SDK is imported DYNAMICALLY inside runCode so any load/bundling issue
// degrades gracefully instead of crashing the whole function.

const TAVILY_URL = 'https://api.tavily.com/search'

export async function webSearch(query, { maxResults = 5 } = {}) {
  const key = process.env.TAVILY_API_KEY
  if (!key) return { error: 'Web search is not configured (TAVILY_API_KEY missing).' }
  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
      }),
    })
    if (!res.ok) return { error: `Search failed (${res.status})` }
    const data = await res.json()
    return {
      answer: data.answer || null,
      results: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        content: (r.content || '').slice(0, 600),
      })),
    }
  } catch (e) {
    return { error: 'Search request error.' }
  }
}

// Execute code in an ephemeral E2B sandbox via the official SDK.
// Supports python and javascript/node.
export async function runCode(code, language = 'python') {
  const key = process.env.E2B_API_KEY
  if (!key) return { error: 'Code execution is not configured (E2B_API_KEY missing).' }

  const lang = (language || 'python').toLowerCase().startsWith('java')
    ? 'javascript'
    : 'python'

  let sbx = null
  try {
    const { Sandbox } = await import('@e2b/code-interpreter')
    sbx = await Sandbox.create({ apiKey: key, timeoutMs: 60_000 })
    const exec = await sbx.runCode(code, { language: lang })
    const stdout = (exec.logs?.stdout || []).join('')
    const stderr = (exec.logs?.stderr || []).join('')
    const err = exec.error
      ? `${exec.error.name}: ${exec.error.value}`
      : ''
    // text result (e.g. last expression / printed results)
    const resultText = (exec.results || [])
      .map((r) => r.text)
      .filter(Boolean)
      .join('\n')

    return {
      stdout: String(stdout).slice(0, 4000),
      stderr: String([stderr, err].filter(Boolean).join('\n')).slice(0, 2000),
      result: String(resultText).slice(0, 2000),
    }
  } catch (e) {
    return { error: 'Execution error: ' + (e?.message || 'unknown') }
  } finally {
    if (sbx) {
      try {
        await sbx.kill()
      } catch {
        /* ignore */
      }
    }
  }
}

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for current, real-time, or factual information. Use when the user asks about recent events, news, prices, or anything you are unsure about.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description:
        'Execute Python or JavaScript code in a secure sandbox and return stdout/stderr. Use for calculations, data processing, or verifying code works.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The code to execute' },
          language: {
            type: 'string',
            enum: ['python', 'javascript', 'bash'],
            description: 'Language of the code',
          },
        },
        required: ['code'],
      },
    },
  },
]
