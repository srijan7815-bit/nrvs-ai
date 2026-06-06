import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Wordmark from './Wordmark'
import { useProfile, saveName } from '../lib/profile'

/** First-login overlay asking the user what NRVS should call them. */
export default function NameSetup() {
  const { name, ready } = useProfile()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!ready || name) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setSaving(true)
    await saveName(value.trim())
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg/95 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Wordmark className="text-3xl" />
          <h1 className="text-heading-md font-semibold">Welcome to NRVS</h1>
          <p className="text-body text-text-secondary">
            What should NRVS call you?
          </p>
        </div>
        <form onSubmit={submit} className="card rounded-lg p-5">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your name"
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:border-text-tertiary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!value.trim() || saving}
            className="btn-primary mt-3 h-11 w-full text-body disabled:opacity-40"
          >
            Continue <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
