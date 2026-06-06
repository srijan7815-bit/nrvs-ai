import { useState } from 'react'
import { Copy, Check, Play, Eye, Loader2, FileCode } from 'lucide-react'
import { runCodeRemote } from '../lib/api'
import { useArtifacts } from '../lib/artifacts'

const RUNNABLE = new Set(['python', 'py', 'javascript', 'js', 'node', 'bash', 'sh'])
const PREVIEWABLE = new Set(['html', 'htm', 'svg'])

/**
 * A code block with: filename header, copy button, and (when applicable)
 * Run (E2B) or Preview (HTML) buttons. Also registers as an artifact.
 */
export default function CodeBlock({ language, filename, code }) {
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState(null)
  const { openArtifact } = useArtifacts()

  const lang = (language || '').toLowerCase()
  const canRun = RUNNABLE.has(lang)
  const canPreview = PREVIEWABLE.has(lang)
  const label = filename || lang || 'code'

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const onRun = async () => {
    setRunning(true)
    setOutput(null)
    try {
      const r = await runCodeRemote(code, lang)
      setOutput(r)
    } catch {
      setOutput({ error: 'Run failed.' })
    } finally {
      setRunning(false)
    }
  }

  const onPreview = () => {
    openArtifact({ type: 'html', title: label, content: code })
  }

  return (
    <div className="my-3 overflow-hidden rounded-md border border-border bg-surface2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-text-secondary">
          <FileCode size={13} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate font-mono">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canRun && (
            <button
              onClick={onRun}
              disabled={running}
              className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary disabled:opacity-50"
              title="Run code"
            >
              {running ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              Run
            </button>
          )}
          {canPreview && (
            <button
              onClick={onPreview}
              className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
              title="Preview"
            >
              <Eye size={13} />
              Preview
            </button>
          )}
          <button
            onClick={onCopy}
            className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary transition-colors hover:bg-border hover:text-text-primary"
            title="Copy"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto p-3 text-body-sm leading-relaxed">
        <code className="font-mono text-text-primary">{code}</code>
      </pre>

      {/* Run output */}
      {output && (
        <div className="border-t border-border bg-bg px-3 py-2 font-mono text-caption">
          {output.error ? (
            <span className="text-danger">{output.error}</span>
          ) : (
            <>
              {output.stdout && (
                <pre className="whitespace-pre-wrap text-text-secondary">
                  {output.stdout}
                </pre>
              )}
              {output.result && (
                <pre className="whitespace-pre-wrap text-text-primary">
                  {output.result}
                </pre>
              )}
              {output.stderr && (
                <pre className="whitespace-pre-wrap text-danger">
                  {output.stderr}
                </pre>
              )}
              {!output.stdout && !output.stderr && !output.result && (
                <span className="text-text-tertiary">
                  (no output)
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
