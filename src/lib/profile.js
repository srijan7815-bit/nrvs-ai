// User display-name + profile prefs, synced to Supabase `profiles` when logged in.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_NAME = 'nrvs.displayName'

let state = { name: null, ready: false }
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

  // 1) Google / OAuth name from auth metadata
  const metaName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    null

  if (!userId || !isCloudEnabled) {
    state = {
      name: localStorage.getItem(LS_NAME) || metaName || null,
      ready: true,
    }
    emit()
    return
  }

  // 2) cloud profile
  let name = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    name = data?.display_name || null
  } catch {
    /* table may not exist yet */
  }

  // 3) if no stored name but Google gave one, save it
  if (!name && metaName) {
    name = metaName
    saveName(metaName)
  }

  state = { name: name || localStorage.getItem(LS_NAME) || null, ready: true }
  emit()
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
