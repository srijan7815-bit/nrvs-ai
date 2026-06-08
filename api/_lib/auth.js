// Server-side auth verification for Vercel API routes.
// Uses the Supabase service role key to verify JWTs without RLS checks.
// Returns the authenticated user or throws a 401.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Always-allowed CORS headers for public API routes ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key, X-API-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // preflight cache for 24h
}

/**
 * Attach CORS headers to a Vercel response object.
 */
export function setCORS(res) {
  for (const [key, val] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, val)
  }
}

/**
 * Verify the Bearer token from Authorization header.
 * Throws an object with `{ status, body }` on failure (for Vercel response).
 *
 * @returns {Promise<{ userId: string, email: string }>} — verified user info
 */
export async function requireAuth(req) {
  // Handle CORS preflight (no body needed).
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

  if (!supabaseUrl || !serviceRoleKey) {
    throw { status: 503, body: { error: 'Authentication service not configured.' } }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  })

  const { data: user, error } = await supabase.auth.getUser(token)

  if (error || !user?.user) {
    throw { status: 401, body: { error: 'Invalid or expired session. Please sign in again.' } }
  }

  return {
    userId: user.user.id,
    email: user.user.email,
    token,
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
 * Send a JSON error response — handles the CORS preflight case (204).
 */
export function sendCORS(res, err) {
  if (err.cors) {
    // Preflight — just respond with 204 and CORS headers.
    setCORS(res)
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}