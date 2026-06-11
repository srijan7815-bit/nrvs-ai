// GET /api/share/:id  — Public endpoint to fetch a shared chat by ID.
// Uses the Supabase service role key server-side so the anon key never
// has access to the shared_chats table.
// Returns only safe public fields: { title, messages[] }.
// The share ID itself is the secret (unguessable UUID).

import { setCORS } from '../_lib/auth.js'

export default async function handler(req, res) {
  setCORS(res, req)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const SUP_URL = process.env.VITE_SUPABASE_URL
  const SR = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUP_URL || !SR) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Service not configured.' }))
    return
  }

  // Extract share ID from the URL path: /api/share/<id>
  const parts = (req.url || '').split('/')
  const id = parts[parts.length - 1]

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid share ID.' }))
    return
  }

  try {
    const r = await fetch(
      `${SUP_URL}/rest/v1/shared_chats?id=eq.${encodeURIComponent(id)}&select=title,mode,snapshot`,
      {
        headers: {
          apikey: SR,
          Authorization: `Bearer ${SR}`,
        },
      }
    )

    if (!r.ok) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Not found.' }))
      return
    }

    const rows = await r.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Not found.' }))
      return
    }

    const row = rows[0]
    // Return only safe public fields — no user_id, thread_id, or internal metadata
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        title: row.title || 'Shared chat',
        messages: row.snapshot?.messages || [],
      })
    )
  } catch {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to fetch share.' }))
  }
}
