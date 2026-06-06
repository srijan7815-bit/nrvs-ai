// Haptic feedback via the Vibration API, gated by the Settings "Haptic feedback" toggle.
// No-ops on unsupported devices (most desktops). Reads the pref from localStorage
// so it works anywhere without prop drilling.

const PREFS_KEY = 'nrvs.prefs.v1'

function hapticEnabled() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return p.haptic !== false // default on
  } catch {
    return true
  }
}

function supported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

const PATTERNS = {
  light: 10,
  medium: 18,
  heavy: 32,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [40, 30, 40, 30, 40],
  select: 8,
}

export function haptic(kind = 'light') {
  if (!supported() || !hapticEnabled()) return
  try {
    navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light)
  } catch {
    /* ignore */
  }
}

// Fire a quick test buzz (used when enabling the toggle), bypassing the pref read
// so the user feels it the moment they switch it on.
export function hapticTest() {
  if (!supported()) return
  try {
    navigator.vibrate(PATTERNS.medium)
  } catch {
    /* ignore */
  }
}
