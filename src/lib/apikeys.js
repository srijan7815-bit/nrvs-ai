// NRVS developer API keys. Stored in Supabase (RLS) when logged in.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

let keys = []
let userId = null
const listeners = new Set()
function emit() {
  for (const l of listeners) l()
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function genKey() {
  const bytes = new Uint8Array(24)
  ;(crypto || window.crypto).getRandomValues(bytes)
  const b = Array.from(bytes)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
  return `nrvs-${b}`
}

export async function initApiKeysForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    keys = []
    emit()
    return
  }
  const { data } = await supabase
    .from('api_keys')
    .select('id,name,key,created_at,last_used_at')
    .order('created_at', { ascending: false })
  keys = (data || []).map((k) => ({
    id: k.id,
    name: k.name,
    key: k.key,
    createdAt: new Date(k.created_at).getTime(),
    lastUsedAt: k.last_used_at ? new Date(k.last_used_at).getTime() : null,
  }))
  emit()
}

// Create a key. Returns the full key string (shown once).
export async function createApiKey(name = 'API key') {
  if (!userId || !isCloudEnabled) {
    throw new Error('Sign in to generate an API key.')
  }
  const key = genKey()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, name: name.trim() || 'API key', key })
    .select('id,created_at')
    .single()
  if (error) throw error
  keys = [
    { id: data.id, name: name.trim() || 'API key', key, createdAt: Date.now(), lastUsedAt: null },
    ...keys,
  ]
  emit()
  return key
}

export async function revokeApiKey(id) {
  keys = keys.filter((k) => k.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('api_keys').delete().eq('id', id)
  }
}

export function getApiKeys() {
  return keys
}
export function useApiKeys() {
  return useSyncExternalStore(subscribe, getApiKeys, getApiKeys)
}
