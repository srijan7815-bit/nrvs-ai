// POST /api/serve  { files:[{name,code}] }  ->  { url, sandboxId } | { error }
// Boots an E2B sandbox, writes the artifact files, installs deps if needed,
// starts the detected server (Node/Python/static), and returns a public URL.
// The sandbox auto-expires after a few minutes.

export const config = { maxDuration: 60 }

const PORT = 3000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const key = process.env.E2B_API_KEY
  if (!key) {
    res.status(503).json({ error: 'Execution not configured (E2B_API_KEY missing).' })
    return
  }

  const body = await readJson(req)
  const files = Array.isArray(body?.files) ? body.files : []
  if (!files.length) {
    res.status(400).json({ error: 'files[] is required' })
    return
  }

  let sbx = null
  try {
    const { Sandbox } = await import('@e2b/code-interpreter')
    sbx = await Sandbox.create({ apiKey: key, timeoutMs: 300_000 }) // 5 min

    // write all files
    for (const f of files) {
      if (!f?.name) continue
      try {
        await sbx.files.write(f.name, f.code ?? '')
      } catch {
        /* ignore */
      }
    }

    const names = files.map((f) => (f.name || '').toLowerCase())
    const has = (n) => names.includes(n)
    const find = (re) => files.find((f) => re.test(f.name || ''))

    let startCmd = null
    let setupCmd = null

    if (has('package.json')) {
      // Node project
      let pkg = {}
      try {
        pkg = JSON.parse(files.find((f) => f.name.toLowerCase() === 'package.json').code)
      } catch {
        /* ignore */
      }
      setupCmd = 'npm install --no-audit --no-fund 2>&1 | tail -2 || true'
      const startScript = pkg?.scripts?.start
      const entry =
        (pkg.main && files.find((f) => f.name === pkg.main)?.name) ||
        find(/(server|index|app|main)\.[cm]?js$/)?.name
      // force PORT=3000 via env
      startCmd = startScript
        ? `PORT=${PORT} npm start`
        : entry
        ? `PORT=${PORT} node ${entry}`
        : null
    } else if (find(/requirements\.txt$/) || find(/\.py$/)) {
      // Python project
      if (find(/requirements\.txt$/)) {
        setupCmd = 'pip install -r requirements.txt 2>&1 | tail -2 || true'
      }
      const flaskFile = find(/(app|server|main|wsgi)\.py$/) || find(/\.py$/)
      if (flaskFile) {
        // try common frameworks; flask/uvicorn/plain
        startCmd =
          `PORT=${PORT} FLASK_APP=${flaskFile.name} ` +
          `(python3 -m flask run --host=0.0.0.0 --port=${PORT} 2>/dev/null || ` +
          `PORT=${PORT} python3 ${flaskFile.name})`
      }
    }

    // Static fallback: serve the folder over http
    if (!startCmd) {
      startCmd = `python3 -m http.server ${PORT} --bind 0.0.0.0`
    }

    if (setupCmd) {
      try {
        await sbx.commands.run(setupCmd, { timeoutMs: 90_000 })
      } catch {
        /* continue even if install partially fails */
      }
    }

    // start server in background
    await sbx.commands.run(startCmd, { background: true })

    // wait for it to come up (poll)
    const host = sbx.getHost(PORT)
    const url = `https://${host}`
    let up = false
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1200))
      try {
        const r = await fetch(url, { method: 'GET' })
        if (r.ok || r.status < 500) {
          up = true
          break
        }
      } catch {
        /* not ready yet */
      }
    }

    // Keep the sandbox alive (don't kill) so the user can interact with it.
    res.status(200).json({
      url,
      sandboxId: sbx.sandboxId,
      ready: up,
      startCmd,
    })
  } catch (e) {
    if (sbx) {
      try {
        await sbx.kill()
      } catch {
        /* ignore */
      }
    }
    res.status(502).json({ error: 'Could not start the app: ' + (e?.message || 'unknown') })
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
