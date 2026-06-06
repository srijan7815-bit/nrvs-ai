// Tiny persisted preferences store for Settings toggles/selections.
import { useCallback, useEffect, useState } from 'react'
import { applyFont } from './fonts'
import { applyTheme } from './theme'

const KEY = 'nrvs.prefs.v1'
const DEFAULTS = {
  haptic: true,
  colorMode: 'System',
  fontId: 'inter',
  model: 'meta/llama-3.3-70b-instruct',
  flowState: false,
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

// Apply the saved font + theme as early as possible (module load).
try {
  const p = load()
  applyFont(p.fontId)
  applyTheme(p.colorMode)
} catch {
  /* ignore */
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
    applyFont(prefs.fontId)
    applyTheme(prefs.colorMode)
  }, [prefs])

  const set = useCallback((key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  return [prefs, set]
}
