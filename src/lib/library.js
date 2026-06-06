// Saved artifacts (Library). Cloud-synced when logged in, localStorage in guest mode.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_KEY = 'nrvs.library.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let items = []
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
    localStorage.setItem(LS_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export async function initLibraryForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    items = loadLocal()
    emit()
    return
  }
  const { data } = await supabase
    .from('library_items')
    .select('id,title,kind,content,thread_id,created_at')
    .order('created_at', { ascending: false })
  items = (data || []).map((x) => ({
    id: x.id,
    title: x.title,
    kind: x.kind,
    content: x.content,
    threadId: x.thread_id,
    createdAt: new Date(x.created_at).getTime(),
  }))
  emit()
}

export async function saveToLibrary({ title, kind = 'html', content, threadId }) {
  const tempId = uid()
  const item = {
    id: tempId,
    title: title || 'Artifact',
    kind,
    content: content || '',
    threadId: threadId || null,
    createdAt: Date.now(),
  }
  items = [item, ...items]
  emit()
  if (userId && isCloudEnabled) {
    try {
      const { data } = await supabase
        .from('library_items')
        .insert({
          user_id: userId,
          title: item.title,
          kind: item.kind,
          content: item.content,
          thread_id: item.threadId,
        })
        .select('id')
        .single()
      if (data?.id) {
        items = items.map((i) => (i.id === tempId ? { ...i, id: data.id } : i))
        emit()
      }
    } catch {
      persistLocal()
    }
  }
  return tempId
}

export async function deleteLibraryItem(id) {
  items = items.filter((i) => i.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('library_items').delete().eq('id', id)
  }
}

export function getLibrary() {
  return items
}
export function useLibrary() {
  return useSyncExternalStore(subscribe, getLibrary, getLibrary)
}
