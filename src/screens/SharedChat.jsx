import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import logoUrl from '../assets/nrvs-logo.png'
import Message from '../components/Message'
import { fetchSharedChat } from '../lib/shares'

/** Public, no-auth view of a shared conversation. */
export default function SharedChat() {
  const { id } = useParams()
  const [data, setData] = useState(undefined) // undefined=loading, null=not found

  useEffect(() => {
    let on = true
    fetchSharedChat(id).then((d) => on && setData(d))
    return () => {
      on = false
    }
  }, [id])

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-tertiary">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-text-primary">
        <img src={logoUrl} alt="NRVS" className="h-12 w-auto opacity-80" />
        <h1 className="text-heading-md font-semibold">Chat not found</h1>
        <p className="text-body text-text-secondary">
          This shared link may have been removed or sharing was stopped.
        </p>
        <Link to="/" className="btn-primary h-10 px-5 text-body-sm">
          Go to NRVS
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="NRVS" className="h-6 w-auto" />
          <span className="text-body-sm text-text-tertiary">Shared chat</span>
        </div>
        <Link
          to="/"
          className="btn-icon h-9 px-4 text-body-sm"
        >
          Try NRVS
        </Link>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="mb-6 text-heading-lg font-semibold">{data.title}</h1>
        {data.messages.length === 0 ? (
          <p className="text-body text-text-tertiary">This chat is empty.</p>
        ) : (
          <div className="space-y-6">
            {data.messages.map((m, i) => (
              <Message
                key={i}
                role={m.role}
                content={m.content}
                image={m.image}
                model={m.model}
                shared
              />
            ))}
          </div>
        )}
        <p className="mt-10 border-t border-border pt-6 text-center text-caption text-text-tertiary">
          This is a read-only conversation shared from NRVS.
        </p>
      </div>
    </div>
  )
}
