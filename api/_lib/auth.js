// Server-side auth verification for Vercel API routes.
// Uses the Supabase service role key to verify JWTs without RLS checks.
// Returns the authenticated user or throws a 401.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Verify the Bearer token from Authorization header.
 * Throws an object with `{ status, body }` on failure (for Vercel response).
 *
 * @returns {Promise<{ userId: string, email: string }>} — verified user info
 */
export async function requireAuth(req) {
  // Vercel serverless functions: token is sent as `Bearer <jwt>` in Authorization header.
  // The client stores it in localStorage and sends it as a custom header.
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
    // If Supabase isn't configured, reject all requests (server-only mode).
    throw { status: 503, body: { error: 'Authentication service not configured.' } }
  }

  // Use service role key to verify JWT — bypasses RLS so we can inspect the payload.
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
 * Parse JSON body from the request (handles edge cases).
 */
export function parseBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

/**
 * Send a JSON error response cleanly.
 */
export function sendError(res, status, error) {
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