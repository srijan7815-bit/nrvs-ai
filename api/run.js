// POST /api/run  { code, language }  -> { stdout, stderr, result } | { error }
// Executes a code block in an E2B sandbox (used by the "Run" button on code blocks).
import { runCode } from './_tools.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const body = await readJson(req)
  const code = typeof body?.code === 'string' ? body.code : ''
  const language = body?.language || 'python'
  if (!code.trim()) {
    res.status(400).json({ error: 'code is required' })
    return
  }
  const result = await runCode(code, language)
  res.status(200).json(result)
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
