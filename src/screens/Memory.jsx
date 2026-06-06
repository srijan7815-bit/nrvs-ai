import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Brain, Trash2, Plus, Sparkles, User } from 'lucide-react'
import Layout from '../components/Layout'
import { useMemories, addMemory, deleteMemory } from '../lib/memory'

export default function Memory() {
  const navigate = useNavigate()
  const memories = useMemories()
  const [draft, setDraft] = useState('')

  const onAdd = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    await addMemory(draft.trim(), 'manual')
    setDraft('')
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
          <h1 className="text-heading-md font-semibold">Memory</h1>
        </div>

        <p className="mb-5 text-body-sm text-text-tertiary">
          NRVS remembers these facts about you across every chat. It also saves
          things it finds useful on its own. You’re in control — delete anything
          anytime.
        </p>

        {/* Add memory */}
        <form onSubmit={onAdd} className="mb-6 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:border-text-tertiary">
            <Brain size={18} className="shrink-0 text-text-tertiary" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add something for NRVS to remember…"
              className="h-11 w-full bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="btn-primary h-11 px-4 text-body-sm disabled:opacity-40"
          >
            <Plus size={16} /> Add
          </button>
        </form>

        {/* List */}
        {memories.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-10 text-center">
            <Brain size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No memories yet</p>
            <p className="text-body-sm text-text-tertiary">
              Add one above, or use the “Remember” button on any message.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="card card-hover flex items-start gap-3 rounded-md px-4 py-3"
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
                <span className="flex-1 text-body text-text-primary">
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
