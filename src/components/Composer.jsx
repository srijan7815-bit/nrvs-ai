import { useRef, useState } from 'react'
import { Plus, Mic, AudioLines, ChevronDown, ArrowUp } from 'lucide-react'
import { MODEL_NAME } from './nav'

/**
 * Functional chat composer.
 * Calls onSend(text). Enter sends, Shift+Enter newlines. Auto-grows.
 */
export default function Composer({ onSend, disabled = false }) {
  const [value, setValue] = useState('')
  const taRef = useRef(null)

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend?.(text)
    setValue('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onInput = (e) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className="card rounded-lg p-3 sm:p-4">
      <textarea
        ref={taRef}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Chat with NRVS…"
        className="max-h-[200px] w-full resize-none bg-transparent px-1 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-icon h-9 w-9"
            aria-label="Add attachment"
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm text-text-secondary"
          >
            {MODEL_NAME}
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-icon h-9 w-9"
            aria-label="Voice input"
          >
            <Mic size={18} strokeWidth={1.75} />
          </button>
          {canSend ? (
            <button
              type="button"
              onClick={submit}
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-black transition-opacity duration-200 hover:opacity-90"
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-black transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
              aria-label="Voice mode"
              disabled={disabled}
            >
              <AudioLines size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
