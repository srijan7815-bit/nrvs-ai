import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Code2,
  AlertTriangle,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useApiKeys, createApiKey, revokeApiKey } from '../lib/apikeys'
import { useAuth } from '../lib/auth'

export default function ApiKeys() {
  const navigate = useNavigate()
  const keys = useApiKeys()
  const { cloud } = useAuth()
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState('') // shown once after creation
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  const endpoint = `${window.location.origin}/api/v1/chat`

  const create = async (e) => {
    e.preventDefault()
    setErr('')
    setCreating(true)
    try {
      const k = await createApiKey(name)
      setNewKey(k)
      setName('')
    } catch (e2) {
      setErr(e2.message || 'Could not create key.')
    } finally {
      setCreating(false)
    }
  }

  const copy = async (text, mark = true) => {
    try {
      await navigator.clipboard.writeText(text)
      if (mark) {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* ignore */
    }
  }

  const curl = `curl ${endpoint} \\
  -H "Authorization: Bearer YOUR_NRVS_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello NRVS"}]}'`

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-2 sm:px-6 lg:pt-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-icon h-9 w-9 border-transparent bg-transparent"
            aria-label="Back"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="text-heading-md font-semibold">Developer API</h1>
        </div>

        <p className="mb-5 text-body-sm text-text-tertiary">
          Generate an API key to use NRVS from your own apps, scripts, or
          anywhere outside this site.
        </p>

        {!cloud && (
          <div className="mb-4 rounded-md border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-body-sm text-accent-orange">
            Sign in to generate and manage API keys.
          </div>
        )}

        {/* Create */}
        <form onSubmit={create} className="card mb-4 flex items-center gap-2 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name (e.g. My script)"
            className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!cloud || creating}
            className="btn-primary h-10 px-4 text-body-sm disabled:opacity-40"
          >
            <Plus size={15} /> Generate
          </button>
        </form>
        {err && <p className="mb-4 text-body-sm text-danger">{err}</p>}

        {/* Newly created key (shown once) */}
        {newKey && (
          <div className="card mb-4 border-accent-blue/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-body-sm text-accent-blue">
              <AlertTriangle size={15} /> Copy this key now — it won’t be shown in
              full again.
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-body-sm text-text-primary">
                {newKey}
              </span>
              <button
                onClick={() => copy(newKey)}
                className="text-text-tertiary hover:text-text-primary"
              >
                {copied ? <Check size={16} className="text-accent-blue" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Existing keys */}
        {keys.length > 0 && (
          <div className="mb-6 space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="card flex items-center gap-3 rounded-md p-3">
                <KeyRound size={16} className="shrink-0 text-text-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body text-text-primary">{k.name}</div>
                  <div className="truncate font-mono text-caption text-text-tertiary">
                    {k.key.slice(0, 10)}…{k.key.slice(-4)}
                  </div>
                </div>
                <button
                  onClick={() => revokeApiKey(k.id)}
                  className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-danger"
                  aria-label="Revoke key"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Usage */}
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2 text-body font-medium text-text-primary">
            <Code2 size={16} /> Quick start
          </div>
          <div className="mb-1 text-caption text-text-tertiary">Endpoint</div>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-body-sm text-text-primary">
              POST {endpoint}
            </span>
            <button onClick={() => copy(endpoint, false)} className="text-text-tertiary hover:text-text-primary">
              <Copy size={15} />
            </button>
          </div>
          <div className="mb-1 text-caption text-text-tertiary">Example (cURL)</div>
          <pre className="overflow-x-auto rounded-md border border-border bg-surface2 p-3 text-caption">
            <code className="font-mono text-text-primary">{curl}</code>
          </pre>
          <p className="mt-3 text-caption text-text-tertiary">
            OpenAI-compatible body. Pass <code className="font-mono">"stream": true</code> for a
            streaming text response.
          </p>
        </div>
      </div>
    </Layout>
  )
}
