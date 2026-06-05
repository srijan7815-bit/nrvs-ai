// Tiny persisted preferences store for Settings toggles/selections.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'nrvs.prefs.v1'
const DEFAULTS = {
  haptic: true,
  colorMode: 'System',
  fontStyle: 'Default',
  model: 'meta/llama-3.3-70b-instruct',
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [prefs])

  const set = useCallback((key, value) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  return [prefs, set]
}
