// User secrets vault (tokens/keys). Cloud-synced (Supabase, RLS) when logged in,
// localStorage fallback in guest mode.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_KEY = 'nrvs.secrets.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let secrets = []
let userId = null
const listeners = new Set()
function emit() {
  if (!userId) persistLocal()
  for (const l of listeners) l()
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}
function persistLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(secrets))
  } catch {
    /* ignore */
  }
}

export async function initSecretsForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    secrets = loadLocal()
    emit()
    return
  }
  const { data } = await supabase
    .from('secrets')
    .select('id,name,value,created_at')
    .order('created_at', { ascending: false })
  secrets = (data || []).map((s) => ({
    id: s.id,
    name: s.name,
    value: s.value,
    createdAt: new Date(s.created_at).getTime(),
  }))
  emit()
}

export async function addSecret(name, value) {
  const n = (name || '').trim()
  const v = (value || '').trim()
  if (!n || !v) return
  const tempId = uid()
  secrets = [{ id: tempId, name: n, value: v, createdAt: Date.now() }, ...secrets]
  emit()
  if (userId && isCloudEnabled) {
    try {
      const { data } = await supabase
        .from('secrets')
        .insert({ user_id: userId, name: n, value: v })
        .select('id')
        .single()
      if (data?.id) {
        secrets = secrets.map((s) => (s.id === tempId ? { ...s, id: data.id } : s))
        emit()
      }
    } catch {
      persistLocal()
    }
  }
}

export async function deleteSecret(id) {
  secrets = secrets.filter((s) => s.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('secrets').delete().eq('id', id)
  }
}

export function getSecrets() {
  return secrets
}
export function useSecrets() {
  return useSyncExternalStore(subscribe, getSecrets, getSecrets)
}
