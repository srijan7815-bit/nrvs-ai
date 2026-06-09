import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Brain, Trash2, Plus, Sparkles, User } from 'lucide-react'
import Layout from '../components/Layout'
import MemoryPopup from '../components/MemoryPopup'
import { useMemories, deleteMemory } from '../lib/memory'

export default function Memory() {
  const navigate = useNavigate()
  const memories = useMemories()
  const [addedFlash, setAddedFlash] = useState(false)

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
          <h1 className="text-heading-md font-semibold">Memory</h1>
        </div>

        <p className="mb-5 text-body-sm text-text-tertiary">
          NRVS remembers these facts about you across every chat. It also saves
          things it finds useful on its own. You're in control — delete anything
          anytime.
        </p>

        {/* Add memory — popup with animated textarea */}
        <div className="mb-6 flex items-center gap-2">
          <div className="relative flex flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3">
            <Brain size={18} className="shrink-0 text-text-tertiary" />
            <span className="flex-1 text-body text-text-tertiary">Add something for NRVS to remember…</span>
            <div className="relative">
              <MemoryPopup content="" onSuccess={() => setAddedFlash(true)}>
                <button
                  className={`relative z-10 flex items-center gap-1.5 rounded-pill px-4 py-2 text-body-sm transition-all ${
                    addedFlash
                      ? 'bg-accent-blue text-white'
                      : 'bg-surface2 text-text-secondary hover:bg-border'
                  }`}
                  onClick={() => setAddedFlash(false)}
                >
                  {addedFlash ? <><Check size={13} /> Added</> : <><Plus size={13} /> Add</>}
                </button>
              </MemoryPopup>
            </div>
          </div>
        </div>

        {/* List */}
        {memories.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-10 text-center">
            <Brain size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No memories yet</p>
            <p className="text-body-sm text-text-tertiary">
              Click "Add" above, or use the Brain icon on any message.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="card card-hover group flex items-start gap-3 rounded-md px-4 py-3"
              >
                {m.source === 'auto' ? (
                  <Sparkles
                    size={16}
                    className="mt-0.5 shrink-0 text-accent-orange"
                    title="Auto-saved by NRVS"
                  />
                ) : (
                  <User
                    size={16}
                    className="mt-0.5 shrink-0 text-text-tertiary"
                    title="Saved by you"
                  />
                )}
                <span className="flex-1 whitespace-pre-wrap text-body text-text-primary">
                  {m.content}
                </span>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="shrink-0 rounded-sm p-1 text-text-tertiary transition-colors hover:text-danger"
                  aria-label="Delete memory"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}