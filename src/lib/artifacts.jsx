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

// Build a runnable HTML document from a set of code blocks (an "artifact").
// If there's an HTML block, it's the base; CSS/JS blocks are injected.
export function compileArtifact(blocks) {
  const html = blocks.find((b) =>
    ['html', 'htm'].includes((b.language || '').toLowerCase())
  )
  const css = blocks.filter((b) => (b.language || '').toLowerCase() === 'css')
  const js = blocks.filter((b) =>
    ['js', 'javascript'].includes((b.language || '').toLowerCase())
  )
  const svg = blocks.find((b) => (b.language || '').toLowerCase() === 'svg')

  if (svg && !html) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:#0f0f0f}</style></head><body>${svg.code}</body></html>`
  }

  let doc = html ? html.code : ''
  if (!doc) {
    // no full HTML doc; scaffold one
    doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>`
  }

  const styleTag = css.length
    ? `<style>\n${css.map((c) => c.code).join('\n')}\n</style>`
    : ''
  const scriptTag = js.length
    ? `<script>\n${js.map((j) => j.code).join('\n')}\n<\/script>`
    : ''

  if (styleTag && doc.includes('</head>')) {
    doc = doc.replace('</head>', `${styleTag}\n</head>`)
  } else if (styleTag) {
    doc = styleTag + doc
  }
  if (scriptTag && doc.includes('</body>')) {
    doc = doc.replace('</body>', `${scriptTag}\n</body>`)
  } else if (scriptTag) {
    doc = doc + scriptTag
  }
  return doc
}
