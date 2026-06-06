import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, Code2, ExternalLink, Copy, Check, FileCode, Play, Loader2, Server } from 'lucide-react'
import { useArtifacts } from '../lib/artifacts'
import { serveArtifact } from '../lib/api'

/**
 * Full-screen artifact panel.
 * - Preview tab: compiled HTML in a sandboxed iframe.
 * - Code tab: a file list (all generated files) + the selected file's source.
 */
export default function ArtifactViewer() {
  const { artifact, closeArtifact } = useArtifacts()
  const [tab, setTab] = useState('preview')
  const [copied, setCopied] = useState(false)
  const [activeFile, setActiveFile] = useState(0)
  const [liveUrl, setLiveUrl] = useState('')
  const [serving, setServing] = useState(false)
  const [serveErr, setServeErr] = useState('')

  const html = artifact?.content || ''
  const files = artifact?.files || []

  // Detect a backend / fullstack artifact (needs a real server to run).
  const isBackend = files.some((f) =>
    /(^|\/)(package\.json|requirements\.txt)$|\.(py)$|(server|app|main)\.[cm]?js$/i.test(
      f.name || ''
    )
  )

  useEffect(() => {
    setActiveFile(0)
    setTab('preview')
    setLiveUrl('')
    setServeErr('')
  }, [artifact])

  const runApp = async () => {
    setServing(true)
    setServeErr('')
    try {
      const r = await serveArtifact(
        files.map((f) => ({ name: f.name, code: f.code }))
      )
      if (r?.url) {
        setLiveUrl(r.url)
        setTab('preview')
        if (!r.ready) setServeErr('Server is starting — it may take a few more seconds.')
      } else {
        setServeErr(r?.error || 'Could not start the app.')
      }
    } catch {
      setServeErr('Could not start the app.')
    } finally {
      setServing(false)
    }
  }

  const blobUrl = useMemo(() => {
    if (!html) return null
    try {
      return URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    } catch {
      return null
    }
  }, [html])

  const currentCode =
    files.length > 0 ? files[activeFile]?.code || '' : html

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tab === 'code' ? currentCode : html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence>
      {artifact && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col bg-black/70 backdrop-blur-sm sm:p-6"
          onClick={closeArtifact}
        >
          <motion.div
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none border border-border bg-surface sm:rounded-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
                {artifact.title || 'Artifact'}
              </span>
              <div className="flex items-center gap-1">
                <div className="mr-1 flex items-center rounded-pill border border-border bg-surface2 p-0.5">
                  <button
                    onClick={() => setTab('preview')}
                    className={`flex items-center gap-1 rounded-pill px-3 py-1 text-caption transition-colors ${
                      tab === 'preview' ? 'bg-border text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    <Eye size={13} /> Preview
                  </button>
                  <button
                    onClick={() => setTab('code')}
                    className={`flex items-center gap-1 rounded-pill px-3 py-1 text-caption transition-colors ${
                      tab === 'code' ? 'bg-border text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    <Code2 size={13} /> Code{files.length > 1 ? ` (${files.length})` : ''}
                  </button>
                </div>
                {isBackend && (
                  <button
                    onClick={runApp}
                    disabled={serving}
                    className="btn-primary mr-1 flex h-8 items-center gap-1.5 px-3 text-caption disabled:opacity-60"
                    title="Run this app on a live server"
                  >
                    {serving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Play size={13} />
                    )}
                    {liveUrl ? 'Restart' : 'Run app'}
                  </button>
                )}
                <button onClick={onCopy} className="btn-icon h-8 w-8" title="Copy">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                {blobUrl && (
                  <a
                    href={blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon flex h-8 w-8"
                    title="Open in new tab"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
                <button onClick={closeArtifact} className="btn-icon h-8 w-8" title="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Serve status bar */}
            {(serving || liveUrl || serveErr) && tab === 'preview' && (
              <div className="flex items-center gap-2 border-b border-border bg-surface2 px-4 py-1.5 text-caption">
                {serving ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-accent-blue" />
                    <span className="text-text-secondary">Booting live server…</span>
                  </>
                ) : liveUrl ? (
                  <>
                    <Server size={12} className="text-accent-blue" />
                    <span className="min-w-0 flex-1 truncate text-text-secondary">
                      Live: {liveUrl}
                    </span>
                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-blue hover:underline"
                    >
                      Open ↗
                    </a>
                  </>
                ) : null}
                {serveErr && <span className="text-text-tertiary">{serveErr}</span>}
              </div>
            )}

            {/* Body */}
            <div className="flex min-h-0 flex-1 bg-bg">
              {tab === 'preview' ? (
                <iframe
                  title="artifact-preview"
                  src={liveUrl || undefined}
                  srcDoc={liveUrl ? undefined : html}
                  sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                  className="h-full w-full bg-white"
                />
              ) : files.length > 1 ? (
                <>
                  {/* File list */}
                  <div className="w-44 shrink-0 overflow-y-auto border-r border-border bg-surface py-2">
                    {files.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveFile(i)}
                        className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-caption transition-colors ${
                          i === activeFile
                            ? 'bg-surface2 text-text-primary'
                            : 'text-text-tertiary hover:bg-border hover:text-text-primary'
                        }`}
                        title={f.name}
                      >
                        <FileCode size={12} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate font-mono">{f.name}</span>
                      </button>
                    ))}
                  </div>
                  <pre className="min-w-0 flex-1 overflow-auto p-4 text-body-sm">
                    <code className="font-mono text-text-primary">{currentCode}</code>
                  </pre>
                </>
              ) : (
                <pre className="h-full w-full overflow-auto p-4 text-body-sm">
                  <code className="font-mono text-text-primary">{currentCode}</code>
                </pre>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
