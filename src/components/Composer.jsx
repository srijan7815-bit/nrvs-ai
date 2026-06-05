import { useEffect, useRef, useState } from 'react'
import { Plus, Mic, AudioLines, ArrowUp, X, ImageIcon } from 'lucide-react'
import ModelPicker from './ModelPicker'
import { usePrefs } from '../lib/prefs'
import {
  createRecognizer,
  speechSupported,
} from '../lib/speech'

/**
 * Functional chat composer with model toggle, voice input (STT), and image attach (OCR/vision).
 * Calls onSend({ text, image }). Enter sends, Shift+Enter newlines.
 */
export default function Composer({ onSend, disabled = false }) {
  const [value, setValue] = useState('')
  const [image, setImage] = useState(null) // { dataUrl, name }
  const [listening, setListening] = useState(false)
  const [prefs, setPref] = usePrefs()
  const taRef = useRef(null)
  const recRef = useRef(null)
  const fileRef = useRef(null)
  const baseTextRef = useRef('')

  useEffect(() => () => recRef.current?.stop?.(), [])

  const submit = () => {
    const text = value.trim()
    if ((!text && !image) || disabled) return
    onSend?.({ text: text || 'Describe / extract text from this image.', image: image?.dataUrl, model: prefs.model })
    setValue('')
    setImage(null)
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

  const toggleMic = () => {
    if (!speechSupported()) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (listening) {
      recRef.current?.stop()
      return
    }
    baseTextRef.current = value ? value.trim() + ' ' : ''
    const rec = createRecognizer({
      onResult: (text) => {
        setValue(baseTextRef.current + text)
      },
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    })
    if (!rec) return
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  const onPickFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage({ dataUrl: reader.result, name: file.name })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const canSend = (value.trim().length > 0 || image) && !disabled

  return (
    <div className="card rounded-lg p-3 sm:p-4">
      {image && (
        <div className="mb-2 flex items-center gap-2">
          <div className="relative">
            <img
              src={image.dataUrl}
              alt={image.name}
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-pill bg-surface2 text-text-secondary ring-1 ring-border hover:text-danger"
              aria-label="Remove image"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
          <span className="flex items-center gap-1 text-caption text-text-tertiary">
            <ImageIcon size={12} /> Image attached — will use vision/OCR
          </span>
        </div>
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={listening ? 'Listening…' : 'Chat with NRVS…'}
        className="max-h-[200px] w-full resize-none bg-transparent px-1 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-icon h-9 w-9 shrink-0"
            aria-label="Attach image"
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>
          <ModelPicker
            value={prefs.model}
            onChange={(id) => setPref('model', id)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className={`btn-icon h-9 w-9 ${
              listening ? 'border-danger text-danger' : ''
            }`}
            aria-label="Voice input"
            title="Voice input (speech-to-text)"
          >
            <Mic size={18} strokeWidth={1.75} className={listening ? 'animate-pulse' : ''} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-black transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
            aria-label={canSend ? 'Send message' : 'Voice mode'}
          >
            {canSend ? (
              <ArrowUp size={18} strokeWidth={2} />
            ) : (
              <AudioLines size={18} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
