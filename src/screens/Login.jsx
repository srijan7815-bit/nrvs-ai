import { useState } from 'react'
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import Wordmark from '../components/Wordmark'
import { useAuth } from '../lib/auth'

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

export default function Login() {
  const { cloud, signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const onEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading(true)
    try {
      await signInWithEmail(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the magic link.')
    } finally {
      setLoading(false)
    }
  }

  const onGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-5 text-text-primary">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, #FF8A3D 0%, rgba(255,138,61,0) 70%)',
        }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-9 flex flex-col items-center gap-5 text-center">
          <Wordmark className="text-5xl" />
          <p className="text-body text-text-secondary">
            Sign in to access your NRVS — anywhere.
          </p>
        </div>

        <div className="card rounded-lg p-6">
          {!cloud && (
            <div className="mb-4 rounded-md border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-body-sm text-accent-orange">
              Cloud auth isn’t configured yet. Add Supabase keys to enable Email
              &amp; Google login.
            </div>
          )}

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={40} className="text-accent-blue" />
              <h2 className="text-heading-md font-semibold">Check your inbox</h2>
              <p className="text-body text-text-secondary">
                We sent a magic sign-in link to{' '}
                <span className="text-text-primary">{email}</span>. Open it on
                any device to access your NRVS.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-1 text-body-sm text-accent-blue hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={onGoogle}
                disabled={!cloud || googleLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-pill bg-white text-body font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </button>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-caption uppercase tracking-wide text-text-tertiary">
                  or
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Email magic link */}
              <form onSubmit={onEmail} className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:border-text-tertiary">
                  <Mail size={18} className="shrink-0 text-text-tertiary" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 w-full bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!cloud || loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface2 text-body font-medium text-text-primary transition-colors hover:bg-border disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Continue with Email
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {error && (
                <p className="mt-3 text-body-sm text-danger">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Legal footer */}
        <p className="mt-8 text-center text-caption text-text-tertiary">
          By continuing you agree to the{' '}
          <a href="/terms" className="hover:text-text-secondary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="hover:text-text-secondary hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}