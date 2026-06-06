import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  KeyRound,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react'
import Layout from '../components/Layout'
import { useSecrets, addSecret, deleteSecret } from '../lib/secrets'

function SecretRow({ s }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const masked = '•'.repeat(Math.min(s.value.length, 24))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="card rounded-md p-3">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="shrink-0 text-text-secondary" />
        <span className="flex-1 truncate text-body font-medium text-text-primary">
          {s.name}
        </span>
        <button
          onClick={() => deleteSecret(s.id)}
          className="rounded-sm p-1 text-text-tertiary hover:text-danger"
          aria-label="Delete secret"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-body-sm text-text-primary">
          {show ? s.value : masked}
        </span>
        <button
          onClick={() => setShow((v) => !v)}
          className="text-text-tertiary hover:text-text-primary"
          aria-label={show ? 'Hide' : 'Reveal'}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          onClick={copy}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Copy"
        >
          {copied ? <Check size={15} className="text-accent-blue" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  )
}

export default function Secrets() {
  const navigate = useNavigate()
  const secrets = useSecrets()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const onAdd = async (e) => {
    e.preventDefault()
    if (!name.trim() || !value.trim()) return
    await addSecret(name, value)
    setName('')
    setValue('')
  }

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
          <h1 className="text-heading-md font-semibold">Secrets</h1>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 py-2.5 text-body-sm text-text-secondary">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent-blue" />
          <span>
            Store API keys & tokens securely. They sync to your private account
            (row-level secured) and are only visible to you.
          </span>
        </div>

        <form onSubmit={onAdd} className="card mb-6 space-y-2 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. OpenAI Key)"
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value (sk-…, ghp_…, etc.)"
              type="password"
              className="h-10 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!name.trim() || !value.trim()}
              className="btn-primary h-10 px-4 text-body-sm disabled:opacity-40"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </form>

        {secrets.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-10 text-center">
            <KeyRound size={26} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No secrets saved</p>
          </div>
        ) : (
          <div className="space-y-2">
            {secrets.map((s) => (
              <SecretRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
