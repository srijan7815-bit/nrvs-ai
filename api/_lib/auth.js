// Server-side auth verification for Vercel API routes.
// Verifies Supabase session JWTs; gracefully returns 503 if Supabase is not configured.

import { createClient } from '@supabase/supabase-js'

// ── CORS headers — restricted to known NRVS origins ──
const ALLOWED_ORIGINS = [
  'https://nrvs-chat.vercel.app',
  'https://nrvs.ai',
  'https://www.nrvs.ai',
  'http://localhost:5173', // dev
  'http://localhost:3000', // dev
]

// The /api/v1/chat endpoint is a public developer API — keep wildcard CORS for that.
const PUBLIC_API_ORIGINS = '*'

const CORS_HEADERS_BASE = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key, X-API-Key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Determine the allowed origin from the request's Origin header.
 * Returns the origin string if allowed, or null.
 */
function getAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.get?.('origin') || ''
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  return null
}

/**
 * Attach CORS headers to a Vercel response object.
 * Restricts Access-Control-Allow-Origin to known NRVS origins.
 */
export function setCORS(res, req) {
  const origin = req ? getAllowedOrigin(req) : null
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://nrvs-chat.vercel.app')
  for (const [key, val] of Object.entries(CORS_HEADERS_BASE)) {
    res.setHeader(key, val)
  }
}

/**
 * Set public (wildcard) CORS — only for the developer API (/api/v1/chat).
 */
export function setPublicCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', PUBLIC_API_ORIGINS)
  for (const [key, val] of Object.entries(CORS_HEADERS_BASE)) {
    res.setHeader(key, val)
  }
}

/**
 * Send a JSON error response with CORS headers.
 */
export function sendError(res, status, error) {
  setCORS(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error }))
}

/**
 * Send a plain-text streaming-ready response.
 */
export function sendStream(res, text, flush = false) {
  res.write(text)
  if (flush && typeof res.flush === 'function') res.flush()
}

/**
 * Verify the Bearer token from Authorization header.
 * Returns { userId, email } on success.
 * Throws { status, body } on failure (for Vercel response).
 */
export async function requireAuth(req) {
  if (req.method === 'OPTIONS') {
    throw { status: 204, cors: true }
  }

  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    req.headers?.get?.('Authorization') || ''

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    throw { status: 401, body: { error: 'Authentication required. Please sign in.' } }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw { status: 503, body: { error: 'Authentication service not configured.' } }
  }

  let supabase
  try {
    supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  } catch (err) {
    throw { status: 503, body: { error: 'Authentication service unavailable.' } }
  }

  let user
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      throw { status: 401, body: { error: 'Invalid or expired session. Please sign in again.' } }
    }
    user = data.user
  } catch (err) {
    if (err.status) throw err
    throw { status: 401, body: { error: 'Invalid or expired session. Please sign in again.' } }
  }

  return { userId: user.id, email: user.email, token }
}

/**
 * Send CORS preflight response (204) — returns true if it handled the request.
 */
export function handleCORS(res, err) {
  if (err?.cors) {
    setCORS(res)
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}

/**
 * Parse JSON body from a Vercel request.
 * Enforces a max body size to prevent oversized payload attacks.
 */
export function parseBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) {
        reject({ status: 413, body: { error: 'Request body too large.' } })
        return
      }
      data += c
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch (e) {
        reject({ status: 400, body: { error: 'Invalid JSON body.' } })
      }
    })
    req.on('error', () => resolve({}))
  })
}
