import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Link as LinkIcon, Copy, Check, Trash2, Radio, Camera } from 'lucide-react'
import Layout from '../components/Layout'
import { useShares, deleteShare } from '../lib/shares'

function shareUrl(id) {
  return `${window.location.origin}/share/${id}`
}

export default function SharedLinks() {
  const navigate = useNavigate()
  const shares = useShares()
  const [copiedId, setCopiedId] = useState(null)

  const copy = async (id) => {
    try {
      await navigator.clipboard.writeText(shareUrl(id))
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* ignore */
    }
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
          <h1 className="text-heading-md font-semibold">Shared links</h1>
        </div>

        <p className="mb-5 text-body-sm text-text-tertiary">
          Anyone with a link below can view that chat. Stop sharing anytime to
          revoke access immediately.
        </p>

        {shares.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-10 text-center">
            <LinkIcon size={26} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No shared links yet</p>
            <p className="text-body-sm text-text-tertiary">
              Open a chat and tap the share icon to create a public link.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {shares.map((s) => (
              <div key={s.id} className="card rounded-md p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body text-text-primary">
                      {s.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-caption text-text-tertiary">
                      {s.mode === 'live' ? (
                        <span className="inline-flex items-center gap-1 text-accent-blue">
                          <Radio size={11} /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Camera size={11} /> Snapshot
                        </span>
                      )}
                      <span className="truncate">{shareUrl(s.id)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => copy(s.id)}
                    className="btn-icon flex h-9 flex-1 items-center justify-center gap-1.5 text-body-sm"
                  >
                    {copiedId === s.id ? <Check size={15} /> : <Copy size={15} />}
                    {copiedId === s.id ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    onClick={() => deleteShare(s.id)}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-pill border border-border px-4 text-body-sm text-danger transition-colors hover:bg-border"
                  >
                    <Trash2 size={15} /> Stop sharing
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
