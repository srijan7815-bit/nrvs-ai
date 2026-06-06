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

// File explorer: writes provided files into a sandbox, runs a shell command,
// and returns stdout/stderr + the (possibly modified) contents of files to read back.
// files: [{ name, content }]; command: bash to run; readBack: [filenames]
export async function fileExplorer({ files = [], command = '', readBack = [] }) {
  const key = process.env.E2B_API_KEY
  if (!key) return { error: 'File tools are not configured (E2B_API_KEY missing).' }
  let sbx = null
  try {
    const { Sandbox } = await import('@e2b/code-interpreter')
    sbx = await Sandbox.create({ apiKey: key, timeoutMs: 90_000 })

    // write provided files
    for (const f of files) {
      if (!f?.name) continue
      try {
        await sbx.files.write(f.name, f.content ?? '')
      } catch {
        /* ignore individual write errors */
      }
    }

    let stdout = ''
    let stderr = ''
    if (command) {
      // run the shell command (read/extract/transform/execute)
      const exec = await sbx.runCode(
        `import subprocess\nr=subprocess.run(${JSON.stringify(['bash', '-lc', command])}, capture_output=True, text=True)\nprint(r.stdout)\nimport sys\nif r.stderr: print(r.stderr, file=sys.stderr)`,
        { language: 'python' }
      )
      stdout = (exec.logs?.stdout || []).join('')
      stderr = (exec.logs?.stderr || []).join('')
    }

    // read back requested files
    const readResults = {}
    for (const name of readBack || []) {
      try {
        readResults[name] = (await sbx.files.read(name)).slice(0, 6000)
      } catch {
        readResults[name] = null
      }
    }

    return {
      stdout: String(stdout).slice(0, 6000),
      stderr: String(stderr).slice(0, 2000),
      files: readResults,
    }
  } catch (e) {
    return { error: 'File explorer error: ' + (e?.message || 'unknown') }
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
  {
    type: 'function',
    function: {
      name: 'file_explorer',
      description:
        'Work with files in a sandbox: write/create files, then run a bash command to read, inspect, extract (zip/tar), transform, or execute them, and read back results. Use when the user attached a file or asks you to process/extract/convert/run files.',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: 'Files to create in the sandbox before running the command',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['name'],
            },
          },
          command: {
            type: 'string',
            description:
              'Bash command to run (e.g. "cat data.csv | head", "unzip a.zip -d out && ls out", "python script.py")',
          },
          readBack: {
            type: 'array',
            description: 'Filenames to read back after the command runs',
            items: { type: 'string' },
          },
        },
        required: ['command'],
      },
    },
  },
]
