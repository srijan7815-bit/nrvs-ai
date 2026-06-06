import { createContext, useCallback, useContext, useState } from 'react'

// Holds the currently-open artifact for the full-screen preview/open panel.
const ArtifactContext = createContext(null)

export function ArtifactProvider({ children }) {
  const [artifact, setArtifact] = useState(null) // { type, title, content, files? }

  const openArtifact = useCallback((a) => setArtifact(a), [])
  const closeArtifact = useCallback(() => setArtifact(null), [])

  return (
    <ArtifactContext.Provider value={{ artifact, openArtifact, closeArtifact }}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifacts() {
  const ctx = useContext(ArtifactContext)
  if (!ctx) throw new Error('useArtifacts must be used within ArtifactProvider')
  return ctx
}

// Parse all fenced code blocks out of markdown text.
// Supports info strings like ```lang or ```lang:filename
export function parseCodeBlocks(text) {
  if (!text) return []
  const blocks = []
  const re = /```([^\n`]*)\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    const info = (m[1] || '').trim()
    let language = info
    let filename = null
    if (info.includes(':')) {
      const [l, f] = info.split(':')
      language = l.trim()
      filename = f.trim()
    }
    blocks.push({ language: language || 'text', filename, code: m[2].replace(/\n$/, '') })
  }
  return blocks
}

const lang = (b) => (b.language || '').toLowerCase()
const isHtml = (b) => ['html', 'htm'].includes(lang(b))
const isCss = (b) => lang(b) === 'css'
const isJs = (b) => ['js', 'javascript', 'jsx', 'mjs'].includes(lang(b))
const isSvg = (b) => lang(b) === 'svg'
const base = (name) => (name || '').split('/').pop()

// Build a runnable HTML document from a set of code blocks (an "artifact").
// - Picks the main HTML file (index.html preferred).
// - Inlines <link rel=stylesheet href="x.css"> and <script src="y.js"> when a
//   matching CSS/JS code block exists (so multi-file front-ends render fully).
// - Injects any remaining CSS/JS blocks that weren't referenced.
export function compileArtifact(blocks) {
  const htmlBlocks = blocks.filter(isHtml)
  const cssBlocks = blocks.filter(isCss)
  const jsBlocks = blocks.filter(isJs)
  const svg = blocks.find(isSvg)

  // SVG-only artifact
  if (svg && !htmlBlocks.length) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#0f0f0f}</style></head><body>${svg.code}</body></html>`
  }

  // Pick main HTML (prefer index.html)
  const html =
    htmlBlocks.find((b) => /index\.html?$/i.test(b.filename || '')) ||
    htmlBlocks[0]

  let doc =
    html?.code ||
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`

  const usedCss = new Set()
  const usedJs = new Set()

  // Inline <link ... href="file.css">
  doc = doc.replace(
    /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi,
    (m, href) => {
      const match = cssBlocks.find((c) => base(c.filename) === base(href))
      if (match) {
        usedCss.add(match)
        return `<style>\n${match.code}\n</style>`
      }
      return '' // drop unresolved external link (won't load in sandbox)
    }
  )

  // Inline <script src="file.js">
  doc = doc.replace(
    /<script[^>]*src=["']([^"']+\.[mc]?jsx?)["'][^>]*>\s*<\/script>/gi,
    (m, src) => {
      const match = jsBlocks.find((j) => base(j.filename) === base(src))
      if (match) {
        usedJs.add(match)
        return `<script>\n${match.code}\n<\/script>`
      }
      return ''
    }
  )

  // Inject any remaining (unreferenced) CSS/JS blocks.
  const extraCss = cssBlocks.filter((c) => !usedCss.has(c))
  const extraJs = jsBlocks.filter((j) => !usedJs.has(j))

  const styleTag = extraCss.length
    ? `<style>\n${extraCss.map((c) => c.code).join('\n')}\n</style>`
    : ''
  const scriptTag = extraJs.length
    ? `<script>\n${extraJs.map((j) => j.code).join('\n')}\n<\/script>`
    : ''

  if (styleTag) {
    doc = doc.includes('</head>')
      ? doc.replace('</head>', `${styleTag}\n</head>`)
      : styleTag + doc
  }
  if (scriptTag) {
    doc = doc.includes('</body>')
      ? doc.replace('</body>', `${scriptTag}\n</body>`)
      : doc + scriptTag
  }
  return doc
}
