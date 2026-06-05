// Browser Web Speech API helpers — STT (recognition) and TTS (synthesis).
// No API key needed; runs entirely in the browser. Gracefully no-ops if unsupported.

export function speechSupported() {
  return (
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  )
}

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function createRecognizer({ onResult, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const rec = new SR()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.continuous = false

  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    finalText = ''
    for (let i = 0; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    onResult?.(finalText || interim, !!finalText)
  }
  rec.onerror = (e) => onError?.(e.error)
  rec.onend = () => onEnd?.(finalText)
  return rec
}

let currentUtterance = null
export function speak(text) {
  if (!ttsSupported()) return
  stopSpeaking()
  // strip simple markdown for nicer speech
  const clean = String(text || '')
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/[*_`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim()
  if (!clean) return
  const u = new SpeechSynthesisUtterance(clean)
  u.rate = 1.0
  u.pitch = 1.0
  currentUtterance = u
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
  currentUtterance = null
}

export function isSpeaking() {
  return ttsSupported() && window.speechSynthesis.speaking
}
