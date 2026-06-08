// POST /api/serve  { files:[{name,code}] }  ->  { url, sandboxId } | { error }
// Boots an E2B sandbox, writes the artifact files, installs deps if needed,
// starts the detected server (Node/Python/static), and returns a public URL.
// The sandbox auto-expires after a few minutes.

import { requireAuth, parseBody, sendError } from './_lib/auth.js'

export const config = { maxDuration: 60 }

const PORT = 3000

export default async function handler(req, res) {
  try { await requireAuth(req) }
  catch (err) { sendError(res, err.status||401, err.body?.error||'Unauthorized'); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const key = process.env.E2B_API_KEY
  if (!key) {
    res.status(503).json({ error: 'Execution not configured (E2B_API_KEY missing).' })
    return
  }

  const body = await parseBody(req)
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
      setupCmd = find(/requirements\.txt$/)
        ? 'pip install -r requirements.txt 2>&1 | tail -2 || true'
        : 'pip install flask 2>&1 | tail -1 || true'
      const pyFile = find(/(app|server|main|wsgi)\.py$/) || find(/\.py$/)
      if (pyFile) {
        const mod = pyFile.name.replace(/\.py$/, '').replace(/\//g, '.')
        // Robust launcher: detect a Flask/FastAPI app object and serve it on
        // 0.0.0.0:PORT regardless of how the file's own __main__ is written.
        const launcher = [
          'import importlib, os',
          `os.environ.setdefault("PORT","${PORT}")`,
          'm=None',
          'try:',
          `    m=importlib.import_module("${mod}")`,
          'except Exception as e:',
          '    print("import-failed",e)',
          'app=getattr(m,"app",None) or getattr(m,"application",None)',
          'if app is not None and hasattr(app,"run"):',
          `    app.run(host="0.0.0.0", port=${PORT})`,
          'elif app is not None:',
          '    import uvicorn',
          `    uvicorn.run(app, host="0.0.0.0", port=${PORT})`,
          'else:',
          `    os.system("python3 ${pyFile.name}")`,
        ].join('\n')
        await sbx.files.write('_nrvs_launch.py', launcher)
        startCmd = `python3 _nrvs_launch.py`
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
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const r = await fetch(url, { method: 'GET' })
        // e2b returns 502 with a "port is not open" body until the server binds
        if (r.status !== 502 && r.status !== 503) {
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
