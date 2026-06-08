import { useState } from 'react'
import { ArrowRight, ShieldCheck, KeyRound, Check, ExternalLink, SkipForward } from 'lucide-react'
import Wordmark from './Wordmark'
import { useProfile, saveName, setConsent, setOnboarded } from '../lib/profile'
import { PROVIDERS } from '../lib/providers'
import { addSecret, useSecrets } from '../lib/secrets'
import { haptic } from '../lib/haptics'

/**
 * First-run onboarding: 1) name (if needed)  2) consent  3) BYOK key setup.
 * Shown to logged-in users who haven't completed it.
 * Google users with a display_name already set skip the name step.
 * Existing users (onboarded: true) see nothing.
 */
export default function Onboarding() {
  const { name, consent, onboarded, ready } = useProfile()
  const secrets = useSecrets()
  const [step, setStep] = useState(0)
  const [value, setValue] = useState('')
  const [keyVals, setKeyVals] = useState({})
  const [saving, setSaving] = useState(false)

  if (!ready) return null

  // Already completed onboarding — show nothing.
  if (onboarded) return null

  // Determine the first step to show.
  // Step 0 = name (only if name is null), step 1 = consent, step 2 = keys.
  const initialStep = name ? 1 : 0

  const submitName = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setSaving(true)
    await saveName(value.trim())
    setSaving(false)
    setStep(1)
  }

  const acceptConsent = async () => {
    haptic('success')
    setConsent(true)
    // Mark as onboarded so we never show this again.
    await setOnboarded(true)
    setStep(2)
  }

  const saveKey = async (p) => {
    const v = (keyVals[p.id] || '').trim()
    if (!v) return
    await addSecret(p.secretName, v)
    setKeyVals((s) => ({ ...s, [p.id]: '' }))
    haptic('success')
  }

  const hasKey = (p) =>
    secrets.some((s) => s.name === p.secretName)

  const finish = () => {
    haptic('medium')
    // consent already set above; onboarded already saved above
  }

  const currentStep = step === 0 ? initialStep : step

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-bg/97 px-5 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Wordmark className="text-3xl" />
        </div>

        {/* Step 0: name — only shown when name is null (non-Google users) */}
        {currentStep === 0 && (
          <form onSubmit={submitName} className="card rounded-lg p-6 text-center">
            <h1 className="text-heading-md font-semibold">Welcome to NRVS</h1>
            <p className="mt-1 mb-4 text-body text-text-secondary">
              What should NRVS call you?
            </p>
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
        )}

        {/* Step 1: consent */}
        {currentStep === 1 && (
          <div className="card rounded-lg p-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={20} className="text-accent-blue" />
              <h1 className="text-heading-md font-semibold">Your consent</h1>
            </div>
            <p className="text-body-sm text-text-secondary">
              To work for you, NRVS needs your permission to:
            </p>
            <ul className="my-3 space-y-2 text-body-sm text-text-secondary">
              {[
                'Securely store details & API keys you choose to share, linked to your account.',
                'Use them to power chat, search, code execution & website generation on your behalf.',
                'Remember useful facts about you to personalize help (you control Memory).',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-accent-blue" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mb-4 text-caption text-text-tertiary">
              You can revoke access and delete everything anytime in Settings.
              Keys are stored encrypted and only accessible to your account.
            </p>
            <button onClick={acceptConsent} className="btn-primary h-11 w-full text-body">
              I agree — continue
            </button>
          </div>
        )}

        {/* Step 2: BYOK keys */}
        {currentStep === 2 && (
          <div className="card rounded-lg p-6">
            <div className="mb-1 flex items-center gap-2">
              <KeyRound size={20} className="text-accent-orange" />
              <h1 className="text-heading-md font-semibold">Connect your keys</h1>
            </div>
            <p className="mb-4 text-body-sm text-text-tertiary">
              Bring your own keys so NRVS runs on your accounts. Optional — you can
              add these later in Settings → Secrets. They&apos;re stored securely and
              revocable anytime.
            </p>

            <div className="space-y-3">
              {PROVIDERS.map((p) => {
                const done = hasKey(p)
                return (
                  <div key={p.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm font-medium text-text-primary">
                        {p.name}
                      </span>
                      {done ? (
                        <span className="flex items-center gap-1 text-caption text-accent-blue">
                          <Check size={13} /> Connected
                        </span>
                      ) : (
                        <a
                          href={p.get}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-caption text-accent-blue hover:underline"
                        >
                          Get key <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <p className="mt-0.5 text-caption text-text-tertiary">{p.purpose}</p>
                    {!done && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={keyVals[p.id] || ''}
                          onChange={(e) =>
                            setKeyVals((s) => ({ ...s, [p.id]: e.target.value }))
                          }
                          placeholder={p.placeholder}
                          type="password"
                          className="h-9 flex-1 rounded-md border border-border bg-bg px-3 font-mono text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                        />
                        <button
                          onClick={() => saveKey(p)}
                          disabled={!(keyVals[p.id] || '').trim()}
                          className="btn-primary h-9 px-3 text-body-sm disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    )}
                    <p className="mt-1 text-[10px] text-text-tertiary">{p.expiry}</p>
                  </div>
                )
              })}
            </div>

            <button onClick={finish} className="btn-primary mt-4 h-11 w-full text-body">
              Done — enter NRVS
            </button>
            <button
              onClick={finish}
              className="mt-2 flex w-full items-center justify-center gap-1 text-body-sm text-text-tertiary hover:text-text-secondary"
            >
              <SkipForward size={13} /> Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}