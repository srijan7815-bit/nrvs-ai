// POST /api/site  { prompt, googleKey?, model? }
// Generates a full website. If a Google AI key is provided, NRVS enhances the
// prompt then delegates to FUISHAN (full-stack generator). Otherwise it falls
// back to NRVS's own rich native generation.
// Streams plain text so it never times out; ends with the generated site code.

import { requireAuth, parseBody, sendError } from './_lib/auth.js'

export const config = { maxDuration: 60 }

const DEFAULT_BASE = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'
const FUISHAN = 'https://fuishan.vercel.app/api/generate'
const FUISHAN_MODEL = 'google/gemma-4-31b-it'

export default async function handler(req, res) {
  try { await requireAuth(req) }
  catch (err) { sendError(res, err.status||401, err.body?.error||'Unauthorized'); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const body = await readJson(req)
  const prompt = (body?.prompt || '').trim()
  const googleKey = (body?.googleKey || '').trim()
  const model = body?.model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.OPENAI_BASE_URL || DEFAULT_BASE

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.write(' ')
  if (typeof res.flush === 'function') res.flush()

  try {
    // 1) Enhance the prompt — only needed for FUISHAN delegation (it gets a
    //    single user message). For native gen we fold richness into the system
    //    prompt to save a round-trip (keeps generation within the time limit).
    let enhanced = prompt
    if (apiKey && googleKey) {
      try {
        const r = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            temperature: 0.7,
            max_tokens: 400,
            messages: [
              {
                role: 'system',
                content:
                  'Rewrite the user idea into a single rich, specific website build brief: pages/sections, visual style, color palette, typography, components, sample content, and interactivity. 1 concise paragraph. Output only the brief.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        })
        if (r.ok) {
          const d = await r.json()
          enhanced = d?.choices?.[0]?.message?.content?.trim() || prompt
        }
      } catch {
        /* keep original */
      }
      res.write('\n__NRVS_BRIEF__' + enhanced + '__END_BRIEF__\n')
      if (typeof res.flush === 'function') res.flush()
    }

    // 2) If Google key present, delegate to FUISHAN.
    if (googleKey) {
      try {
        const fr = await fetch(FUISHAN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: enhanced }],
            apiKey: googleKey,
            model: FUISHAN_MODEL,
          }),
        })
        const fd = await fr.json().catch(() => ({}))
        if (fr.ok && (fd.code || fd.isCode)) {
          res.write('__NRVS_SOURCE__fuishan\n')
          res.write(typeof fd.code === 'string' ? fd.code : JSON.stringify(fd.code))
          res.end()
          return
        }
        // FUISHAN failed -> note + fall through to native
        res.write(
          '__NRVS_SOURCE__native\n_(FUISHAN unavailable: ' +
            String(fd.error || fr.status).slice(0, 80) +
            ' — generating with NRVS.)_\n\n'
        )
      } catch {
        res.write('__NRVS_SOURCE__native\n')
      }
    } else {
      res.write('__NRVS_SOURCE__native\n')
    }

    // 3) Native rich generation (streamed).
    if (!apiKey) {
      res.write('_(Model not configured.)_')
      res.end()
      return
    }
    const upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content:
              'You are an elite front-end engineer. Build a COMPLETE, polished, modern, responsive multi-file website. ' +
              'Output ```html:index.html, ```css:styles.css, ```javascript:app.js (link the css/js from the html). ' +
              'Rich visual design: cohesive palette, great typography, hero, sections, cards, buttons with hover states, ' +
              'sticky nav, footer, subtle animations, realistic placeholder content. Mobile-first responsive. ' +
              'Never produce a bare/unstyled page. Output only the code blocks.',
          },
          { role: 'user', content: enhanced },
        ],
      }),
    })
    if (!upstream.ok || !upstream.body) {
      res.write('_(Generation failed.)_')
      res.end()
      return
    }
    const reader = upstream.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (!t.startsWith('data:')) continue
        const d = t.slice(5).trim()
        if (d === '[DONE]') continue
        try {
          const tok = JSON.parse(d)?.choices?.[0]?.delta?.content
          if (tok) {
            res.write(tok)
            if (typeof res.flush === 'function') res.flush()
          }
        } catch {
          /* ignore */
        }
      }
    }
    res.end()
  } catch (e) {
    res.write('\n_(Error: ' + (e?.message || 'failed') + ')_')
    res.end()
  }
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
