import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Brain, Trash2, Plus, Check, Sparkles, User } from 'lucide-react'
import Layout from '../components/Layout'
import { useMemories, addMemory, deleteMemory } from '../lib/memory'
import { haptic } from '../lib/haptics'

export default function Memory() {
  const navigate = useNavigate()
  const memories = useMemories()
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('idle') // idle | success
  const textareaRef = useRef(null)

  const handleChange = (e) => {
    setValue(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleAdd = async () => {
    const text = value.trim()
    if (!text) return
    haptic('success')
    await addMemory(text, 'manual')
    setValue('')
    setStatus('success')
    const ta = textareaRef.current
    if (ta) ta.style.height = 'auto'
    setTimeout(() => setStatus('idle'), 1800)
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
          things it finds useful on its own. You're in control — delete anything
          anytime.
        </p>

        {/* Direct add memory */}
        <div className="mb-6 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Add something for NRVS to remember…"
            rows={2}
            className="flex-1 resize-none overflow-hidden rounded-lg border border-border bg-surface px-3 py-2.5 text-body text-text-primary placeholder:text-text-tertiary focus:border-text-tertiary focus:outline-none"
            style={{ minHeight: '52px', height: '52px' }}
          />
          <button
            onClick={handleAdd}
            disabled={!value.trim() || status === 'success'}
            className={`flex h-[52px] shrink-0 items-center gap-1.5 rounded-lg px-4 text-body-sm transition-all ${
              status === 'success'
                ? 'bg-accent-blue text-white'
                : value.trim()
                ? 'bg-surface2 text-text-primary hover:bg-border'
                : 'bg-surface2 text-text-tertiary'
            }`}
          >
            {status === 'success' ? (
              <>
                <Check size={14} />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Add</span>
              </>
            )}
          </button>
        </div>

        {/* List */}
        {memories.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-10 text-center">
            <Brain size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No memories yet</p>
            <p className="text-body-sm text-text-tertiary">
              Type above and press "Add", or use the Brain icon on any message.
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