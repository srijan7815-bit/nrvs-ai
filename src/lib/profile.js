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

export async function initProfile(user) {
  userId = user?.id || null

  // Google / OAuth name from auth metadata
  const metaName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    null

  const localConsent = localStorage.getItem(LS_CONSENT) === '1'
  const localOnboarded = localStorage.getItem(LS_ONBOARDED) === '1'

  if (!userId || !isCloudEnabled) {
    state = {
      name: localStorage.getItem(LS_NAME) || metaName || null,
      consent: localConsent,
      onboarded: localOnboarded,
      ready: true,
    }
    emit()
    return
  }

  // Cloud: load profile from Supabase (fall back gracefully if table/column missing)
  let profileName = null
  let onboardedFromCloud = false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, onboarded')
      .eq('id', userId)
      .maybeSingle()
    profileName = data?.display_name || null
    onboardedFromCloud = !!data?.onboarded
  } catch {
    /* table or column may not exist yet */
  }

  // If no stored name but Google gave one, save it
  if (!profileName && metaName) {
    profileName = metaName
    saveName(metaName)
  }

  state = {
    name: profileName || localStorage.getItem(LS_NAME) || null,
    consent: localConsent,
    onboarded: onboardedFromCloud || localOnboarded,
    ready: true,
  }
  emit()
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

export async function setOnboarded(v) {
  state = { ...state, onboarded: !!v }
  emit()
  try {
    localStorage.setItem(LS_ONBOARDED, v ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (userId && isCloudEnabled) {
    try {
      await supabase
        .from('profiles')
        .upsert({ id: userId, onboarded: true }, { onConflict: 'id' })
    } catch {
      /* ignore */
    }
  }
}

export async function saveName(name) {
  const clean = (name || '').trim()
  if (!clean) return
  state = { ...state, name: clean }
  emit()
  try {
    localStorage.setItem(LS_NAME, clean)
  } catch {
    /* ignore */
  }
  if (userId && isCloudEnabled) {
    try {
      await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: clean }, { onConflict: 'id' })
    } catch {
      /* ignore */
    }
  }
}

export function getProfile() {
  return state
}

export function useProfile() {
  return useSyncExternalStore(subscribe, getProfile, getProfile)
}