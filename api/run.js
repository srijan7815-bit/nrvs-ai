// POST /api/run  { code, language }  -> { stdout, stderr, result } | { error }
// Executes a code block in an E2B sandbox (used by the "Run" button on code blocks).
import { runCode } from './_tools.js'
import { requireAuth, setCORS, sendError, parseBody } from './_lib/auth.js'

export default async function handler(req, res) {
  try { await requireAuth(req) }
  catch (err) {
    if (err?.cors) { setCORS(res, req); res.statusCode = 204; res.end(); return }
    sendError(res, err.status || 401, err.body?.error || 'Unauthorized')
    return
  }
  if (req.method === 'OPTIONS') { setCORS(res, req); res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') {
    setCORS(res, req); res.statusCode = 405; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  let body
  try { body = await parseBody(req) }
  catch (e) { sendError(res, 400, e.body?.error || 'Invalid JSON body'); return }

  const code = typeof body?.code === 'string' ? body.code : ''
  const language = body?.language || 'python'
  if (!code.trim()) {
    setCORS(res, req); res.statusCode = 400; res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'code is required' }))
    return
  }
  const result = await runCode(code, language)
  setCORS(res, req); res.statusCode = 200; res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result))
}
