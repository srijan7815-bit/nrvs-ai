import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, MessageCircle, Brain, Code2 } from 'lucide-react'
import { MODEL_GROUPS, modelLabel } from '../lib/models'

const CAT_ICON = {
  Chat: MessageCircle,
  Reasoning: Brain,
  Code: Code2,
}

/** Dropdown to select the active NVIDIA model, grouped by Chat / Reasoning / Code. */
export default function ModelPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm text-text-secondary"
      >
        {modelLabel(value)}
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-50 max-h-[60vh] w-72 overflow-y-auto rounded-md border border-border bg-surface p-1.5 shadow-2xl animate-fadeIn">
          {MODEL_GROUPS.map((group) => {
            const Icon = CAT_ICON[group.category] || MessageCircle
            return (
              <div key={group.category} className="mb-1 last:mb-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                  <Icon size={12} strokeWidth={2} />
                  {group.category}
                </div>
                {group.models.map((m) => {
                  const active = m.id === value
                  return (
                    <button
                      key={group.category + m.id}
                      onClick={() => {
                        onChange?.(m.id)
                        setOpen(false)
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-left transition-colors duration-150 ${
                        active
                          ? 'bg-surface2 text-text-primary'
                          : 'text-text-secondary hover:bg-border hover:text-text-primary'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm">
                          {m.name}
                        </span>
                        {m.hint && (
                          <span className="block truncate text-caption text-text-tertiary">
                            {m.hint}
                          </span>
                        )}
                      </span>
                      {active && (
                        <Check
                          size={15}
                          strokeWidth={2}
                          className="shrink-0 text-accent-blue"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
