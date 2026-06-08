// User display-name + profile prefs, synced to Supabase `profiles` when logged in.
// Onboarding state is stored in the `profiles.onboarded` column (cloud) or localStorage (local).
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_NAME = 'nrvs.displayName'
const LS_CONSENT = 'nrvs.consent.v1'
const LS_ONBOARDED = 'nrvs.onboarded.v1'

let state = { name: null, consent: false, onboarded: false, ready: false }
let userId = null
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function persistName(name) {
  try {
    localStorage.setItem(LS_NAME, name)
  } catch {
    /* ignore */
  }
  if (userId && isCloudEnabled) {
    // Fire-and-forget DB save — don't block the UI.
    supabase
      .from('profiles')
      .upsert({ id: userId, display_name: name }, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('[NRVS] Failed to save display_name:', error.message)
      })
  }
}

function persistOnboarded(v) {
  try {
    localStorage.setItem(LS_ONBOARDED, v ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (userId && isCloudEnabled) {
    supabase
      .from('profiles')
      .upsert({ id: userId, onboarded: !!v }, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) console.warn('[NRVS] Failed to save onboarded:', error.message)
      })
  }
}

/**
 * Initialize profile for the given user.
 *
 * IMPORTANT: This is split into a SYNCHRONOUS pass and an ASYNC pass.
 *
 * SYNC — runs immediately so the UI gets the correct `name` / `onboarded`
 * values before `ready` is set to `true`.  This prevents the Onboarding
 * overlay from rendering with stale (null) data.
 *
 * ASYNC — fetches cloud data in the background and fires a second `emit()`
 * if the cloud state differs from what we already set.
 */
export function initProfile(user) {
  userId = user?.id || null

  // ── Determine starting values from all available sources ──
  const localName = (() => {
    try { return localStorage.getItem(LS_NAME) || null } catch { return null }
  })()
  const localConsent = (() => {
    try { return localStorage.getItem(LS_CONSENT) === '1' } catch { return false }
  })()
  const localOnboarded = (() => {
    try { return localStorage.getItem(LS_ONBOARDED) === '1' } catch { return false }
  })()

  // Google / OAuth name is available synchronously from the auth session.
  const metaName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    null

  // ── LOCAL / NO-CLOUD path ──
  if (!userId || !isCloudEnabled) {
    state = {
      name: localName || metaName || null,
      consent: localConsent,
      onboarded: localOnboarded,
      ready: true,
    }
    emit()
    return
  }

  // ── CLOUD path: set synchronous values FIRST (before DB fetch) ──
  // Priority: Google metadata > localStorage > null
  const resolvedName = metaName || localName || null

  // For brand-new users the DB fetch will return null (no row yet).
  // We never treat "no DB row yet" as `onboarded = true`.
  // Only an explicit `true` from the DB marks them as having completed.
  state = {
    name: resolvedName,
    consent: localConsent,
    onboarded: false, // DB fetch is the authoritative source
    ready: true,      // UI gets a useful default immediately
  }
  emit()

  // Save Google name to DB if we have one and it's not already stored.
  if (resolvedName && resolvedName !== localName) {
    persistName(resolvedName)
  }

  // ── ASYNC: fetch cloud profile, reconcile if needed ──
  supabase
    .from('profiles')
    .select('display_name, onboarded')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) return // table/column may not exist yet — ignore

      const cloudName = data?.display_name || null
      const cloudOnboarded = !!data?.onboarded

      // Reconcile: use cloud name if better than what we already have.
      // (Cloud name is authoritative for signed-in users.)
      const bestName = cloudName || resolvedName || null

      // Only update if cloud state differs from what we set synchronously.
      if (
        state.name !== bestName ||
        state.onboarded !== cloudOnboarded
      ) {
        state = {
          name: bestName,
          consent: state.consent,
          onboarded: cloudOnboarded,
          ready: true,
        }
        emit()
      }
    })
}

export function setConsent(v) {
  state = { ...state, consent: !!v }
  emit()
  try {
    localStorage.setItem(LS_CONSENT, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function setOnboarded(v) {
  state = { ...state, onboarded: !!v }
  emit()
  persistOnboarded(!!v)
}

export function saveName(name) {
  const clean = (name || '').trim()
  if (!clean) return
  state = { ...state, name: clean }
  emit()
  persistName(clean)
}

export function getProfile() {
  return state
}

export function useProfile() {
  return useSyncExternalStore(subscribe, getProfile, getProfile)
}