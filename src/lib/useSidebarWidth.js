// Resizable sidebar width — persists to localStorage, clamped to [MIN, MAX]
import { useState, useEffect, useCallback } from 'react'

const KEY = 'nrvs.sidebarWidth'
const MIN = 180
const MAX = 400
const DEFAULT = 280

export function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored) {
        const n = parseInt(stored, 10)
        if (n >= MIN && n <= MAX) return n
      }
    } catch { /* ignore */ }
    return DEFAULT
  })

  const setWidthBounded = useCallback((w) => {
    const clamped = Math.min(MAX, Math.max(MIN, w))
    setWidth(clamped)
    try { localStorage.setItem(KEY, String(clamped)) } catch { /* ignore */ }
  }, [])

  return { width, setWidth: setWidthBounded, min: MIN, max: MAX }
}