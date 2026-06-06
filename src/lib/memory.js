// Memory store: facts NRVS remembers about the user across all chats.
// - Cloud (Supabase): persisted in `memories` table, scoped by RLS.
// - Guest/local: localStorage.
// Same subscription pattern as the thread store.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const KEY = 'nrvs.memories.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let memories = []
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
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function persistLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memories))
  } catch {
    /* ignore */
  }
}

export async function initMemoryForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    memories = loadLocal()
    emit()
    return
  }
  const { data } = await supabase
    .from('memories')
    .select('id,content,source,created_at')
    .order('created_at', { ascending: false })
  memories = (data || []).map((m) => ({
    id: m.id,
    content: m.content,
    source: m.source,
    createdAt: new Date(m.created_at).getTime(),
  }))
  emit()
}

export async function addMemory(content, source = 'manual') {
  const text = (content || '').trim()
  if (!text) return null
  // de-dupe (case-insensitive)
  if (memories.some((m) => m.content.toLowerCase() === text.toLowerCase()))
    return null

  // Optimistic: show it immediately with a temp id.
  const tempId = uid()
  memories = [
    { id: tempId, content: text, source, createdAt: Date.now() },
    ...memories,
  ]
  emit()

  // Try to persist to the cloud; if it fails, keep it locally so it never vanishes.
  if (userId && isCloudEnabled) {
    try {
      const { data, error } = await supabase
        .from('memories')
        .insert({ user_id: userId, content: text, source })
        .select('id')
        .single()
      if (!error && data?.id) {
        memories = memories.map((m) =>
          m.id === tempId ? { ...m, id: data.id } : m
        )
        emit()
        return data.id
      }
    } catch {
      /* fall through to local persistence */
    }
    // cloud failed (e.g. table missing) -> persist locally as a safety net
    persistLocal()
  }
  return tempId
}

export async function deleteMemory(id) {
  memories = memories.filter((m) => m.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('memories').delete().eq('id', id)
  }
}

export function getMemories() {
  return memories
}

// Compact string injected into the system prompt so the model "remembers".
export function memoryContext() {
  if (!memories.length) return ''
  return memories.map((m) => `- ${m.content}`).join('\n')
}

export function useMemories() {
  return useSyncExternalStore(subscribe, getMemories, getMemories)
}
