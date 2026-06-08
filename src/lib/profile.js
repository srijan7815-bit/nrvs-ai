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
  try { localStorage.setItem(LS_NAME, name) } catch { /* ignore */ }
  if (userId && isCloudEnabled) {
    supabase
      .from('profiles')
      .upsert({ id: userId, display_name: name }, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.warn('[NRVS] saveName failed:', error.message) })
  }
}

function persistOnboarded(v) {
  try { localStorage.setItem(LS_ONBOARDED, v ? '1' : '0') } catch { /* ignore */ }
  if (userId && isCloudEnabled) {
    supabase
      .from('profiles')
      .upsert({ id: userId, onboarded: !!v }, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.warn('[NRVS] setOnboarded failed:', error.message) })
  }
}

/**
 * Initialize profile for the given user.
 *
 * Sync pass: sets state immediately so the first render has correct values.
 *   - name: metaName (Google/OAuth) > localStorage > null
 *   - onboarded: localStorage true > cloud true > false
 *     This order prevents flashing "onboarding" for existing cloud users whose
 *     DB query might fail or whose `onboarded` column doesn't exist yet.
 *
 * Async pass (cloud only): reconciles cloud state after initial render.
 *   - Only upgrades onboarded to true if DB confirms it.
 *   - If DB says false or fails, keep the localStorage / default value.
 */
export function initProfile(user, metaName) {
  userId = user?.id || null

  // ── Local-only fallback ──
  if (!userId || !isCloudEnabled) {
    state = {
      name: metaName || localStorage.getItem(LS_NAME) || null,
      consent: localStorage.getItem(LS_CONSENT) === '1',
      onboarded: localStorage.getItem(LS_ONBOARDED) === '1',
      ready: true,
    }
    emit()
    return
  }

  // ── Cloud path: resolve values synchronously first ──
  const localName = (() => { try { return localStorage.getItem(LS_NAME) || null } catch { return null } })()
  const localConsent = (() => { try { return localStorage.getItem(LS_CONSENT) === '1' } catch { return false } })()
  const localOnboarded = localStorage.getItem(LS_ONBOARDED) === '1'

  // Priority: Google metadata name > localStorage > null
  const resolvedName = metaName || localName || null

  // Trust localStorage for existing users; require explicit cloud DB true for new ones.
  // localOnboarded = true means they've completed onboarding before on this browser.
  // cloudOnboarded = true (when DB confirms) means they've completed onboarding on this account.
  state = {
    name: resolvedName,
    consent: localConsent,
    onboarded: localOnboarded,  // start from localStorage (no flash for existing users)
    ready: true,
  }
  emit()

  // Persist Google name to DB if we have one and it's better than what's stored.
  if (metaName && metaName !== localName) {
    persistName(metaName)
  }

  // ── Async: fetch cloud profile, only upgrade onboarded to true ──
  supabase
    .from('profiles')
    .select('display_name, onboarded')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) return // table/column may not exist yet, or RLS blocks it — ignore

      const cloudName = data?.display_name || null
      const cloudOnboarded = !!data?.onboarded

      // Reconcile name: use cloud name if it's better.
      const bestName = cloudName || resolvedName || null

      if (bestName !== state.name || state.onboarded !== cloudOnboarded) {
        // Only flip onboarded to true if cloud confirms it.
        // Keep current value (localStorage default) if cloud says false or null.
        const newOnboarded = cloudOnboarded ? true : state.onboarded
        state = { name: bestName, consent: state.consent, onboarded: newOnboarded, ready: true }
        emit()
      }
    })
}

export function setConsent(v) {
  state = { ...state, consent: !!v }
  emit()
  try { localStorage.setItem(LS_CONSENT, v ? '1' : '0') } catch { /* ignore */ }
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