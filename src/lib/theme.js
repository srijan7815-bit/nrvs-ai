// Applies the color theme (Dark / Light / System) by toggling a class on <html>.
// 'System' follows the OS and live-updates when the OS theme changes.

let mql = null
let currentMode = 'System'

function resolve(mode) {
  if (mode === 'Light') return 'light'
  if (mode === 'Dark') return 'dark'
  // System
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  }
  return 'dark'
}

function paint(mode) {
  const el = document.documentElement
  const resolved = resolve(mode)
  el.classList.remove('theme-dark', 'theme-light')
  el.classList.add(resolved === 'light' ? 'theme-light' : 'theme-dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#ffffff' : '#0f0f0f')
}

export function applyTheme(mode = 'System') {
  if (typeof document === 'undefined') return
  currentMode = mode || 'System'
  paint(currentMode)

  // (Re)bind OS listener only when in System mode.
  if (mql) {
    mql.onchange = null
    mql = null
  }
  if (currentMode === 'System' && window.matchMedia) {
    mql = window.matchMedia('(prefers-color-scheme: light)')
    mql.onchange = () => paint('System')
  }
}
