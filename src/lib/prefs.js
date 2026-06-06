// Tiny persisted preferences store for Settings toggles/selections.
import { useCallback, useEffect, useState } from 'react'
import { applyFont } from './fonts'

const KEY = 'nrvs.prefs.v1'
const DEFAULTS = {
  haptic: true,
  colorMode: 'System',
  fontId: 'inter',
  model: 'meta/llama-3.3-70b-instruct',
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

// Apply the saved font as early as possible (module load).
try {
  applyFont(load().fontId)
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
  }, [prefs])

  const set = useCallback((key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  return [prefs, set]
}
