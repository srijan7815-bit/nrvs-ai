import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  Mic,
  AudioLines,
  ArrowUp,
  X,
  ImageIcon,
  Image as ImageTile,
  FileText,
  Paperclip,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import ModelPicker from './ModelPicker'
import { usePrefs } from '../lib/prefs'
import { haptic } from '../lib/haptics'
import {
  createRecognizer,
  speechSupported,
} from '../lib/speech'

/**
 * Functional chat composer with model toggle, voice input (STT), image attach (OCR/vision),
 * and an upload picker (Photo / Files). Calls onSend({ text, image, file }).
 */
export default function Composer({ onSend, onLive, disabled = false }) {
  const [value, setValue] = useState('')
  const [image, setImage] = useState(null) // { dataUrl, name }
  const [file, setFile] = useState(null) // { name, size }
  const [listening, setListening] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [prefs, setPref] = usePrefs()
  const taRef = useRef(null)
  const recRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)
  const baseTextRef = useRef('')

  useEffect(() => () => recRef.current?.stop?.(), [])

  const submit = () => {
    const text = value.trim()
    if ((!text && !image && !file) || disabled) return
    haptic('medium')
    let outText = text
    if (!outText && image) outText = 'Describe / extract text from this image.'
    if (!outText && file) outText = `Attached file: ${file.name}`
    onSend?.({
      text: outText,
      image: image?.dataUrl,
      file: file ? { name: file.name } : null,
      model: prefs.model,
    })
    setValue('')
    setImage(null)
    setFile(null)
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
    haptic('light')
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
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      alert('Please choose an image file.')
      return
    }
    setFile(null)
    const reader = new FileReader()
    reader.onload = () => setImage({ dataUrl: reader.result, name: f.name })
    reader.readAsDataURL(f)
    e.target.value = ''
    setPickerOpen(false)
  }

  const onPickDoc = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImage(null)
    setFile({ name: f.name, size: f.size })
    e.target.value = ''
    setPickerOpen(false)
  }

  const openPhoto = () => {
    haptic('light')
    fileRef.current?.click()
  }
  const openDoc = () => {
    haptic('light')
    docRef.current?.click()
  }

  const canSend = (value.trim().length > 0 || image || file) && !disabled

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

      {file && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface2 px-3 py-2">
            <FileText size={16} className="text-text-secondary" />
            <span className="max-w-[180px] truncate text-body-sm text-text-primary">
              {file.name}
            </span>
            <button
              onClick={() => setFile(null)}
              className="text-text-tertiary hover:text-danger"
              aria-label="Remove file"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <span className="text-caption text-text-tertiary">File attached</span>
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
          <input
            ref={docRef}
            type="file"
            className="hidden"
            onChange={onPickDoc}
          />

          {/* Upload picker */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                haptic('light')
                setPickerOpen((o) => !o)
              }}
              className="btn-icon h-9 w-9"
              aria-label="Add attachment"
            >
              <Plus
                size={18}
                strokeWidth={1.75}
                className={`transition-transform ${pickerOpen ? 'rotate-45' : ''}`}
              />
            </button>

            <AnimatePresence>
              {pickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setPickerOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute bottom-11 left-0 z-50 flex gap-2 rounded-md border border-border bg-surface p-2 shadow-2xl"
                  >
                    <button
                      type="button"
                      onClick={openPhoto}
                      className="flex w-24 flex-col items-center gap-2 rounded-md border border-border bg-surface2 p-3 text-center transition-colors hover:bg-border"
                    >
                      <ImageTile size={22} className="text-accent-blue" />
                      <span className="text-body-sm text-text-primary">Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={openDoc}
                      className="flex w-24 flex-col items-center gap-2 rounded-md border border-border bg-surface2 p-3 text-center transition-colors hover:bg-border"
                    >
                      <Paperclip size={22} className="text-accent-orange" />
                      <span className="text-body-sm text-text-primary">Files</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
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
              onClick={() => {
                haptic('medium')
                onLive?.()
              }}
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-white text-black transition-opacity duration-200 hover:opacity-90"
              aria-label="Live voice mode"
              title="Live voice conversation"
            >
              <AudioLines size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
