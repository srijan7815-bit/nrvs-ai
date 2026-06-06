// Cloud-aware thread store.
// - Logged in (Supabase): reads/writes go to Postgres, scoped to the user via RLS.
// - Guest / no cloud: falls back to localStorage.
// Keeps an in-memory mirror with subscriptions so React hooks stay synchronous.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const KEY = 'nrvs.threads.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

// ---- in-memory state ----
let threads = []
let userId = null // when set => cloud mode
const listeners = new Set()

function emit() {
  if (!userId) persistLocal()
  for (const l of listeners) l()
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---- localStorage helpers ----
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function persistLocal() {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads))
  } catch {
    /* ignore quota */
  }
}

// ─────────────────────────────────────────────
// Session wiring — call when auth state changes.
// ─────────────────────────────────────────────
export async function initStoreForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    threads = loadLocal()
    emit()
    return
  }
  await refreshFromCloud()
  // Optional: migrate any local guest threads into the cloud on first login.
  await maybeMigrateLocal()
}

export async function refreshFromCloud() {
  if (!userId || !isCloudEnabled) return
  const { data: t } = await supabase
    .from('threads')
    .select('id,title,created_at,updated_at')
    .order('updated_at', { ascending: false })

  const ids = (t || []).map((x) => x.id)
  let msgs = []
  if (ids.length) {
    const { data: m } = await supabase
      .from('messages')
      .select('id,thread_id,role,content,image,model,created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: true })
    msgs = m || []
  }
  threads = (t || []).map((th) => ({
    id: th.id,
    title: th.title,
    createdAt: new Date(th.created_at).getTime(),
    updatedAt: new Date(th.updated_at).getTime(),
    messages: msgs
      .filter((x) => x.thread_id === th.id)
      .map((x) => ({
        id: x.id,
        role: x.role,
        content: x.content,
        image: x.image || null,
        model: x.model || null,
      })),
  }))
  emit()
}

async function maybeMigrateLocal() {
  const local = loadLocal()
  if (!local.length) return
  for (const th of local) {
    const newId = await createThread(th.title)
    for (const m of th.messages || []) {
      await addMessage(newId, {
        role: m.role,
        content: m.content,
        image: m.image,
        model: m.model,
      })
    }
  }
  localStorage.removeItem(KEY)
  await refreshFromCloud()
}

// ─────────────────────────────────────────────
// CRUD (async; safe to await or fire-and-forget)
// ─────────────────────────────────────────────
export async function createThread(firstMessage) {
  const title =
    (firstMessage &&
      firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '…' : '')) ||
    'New thread'

  if (userId && isCloudEnabled) {
    const { data, error } = await supabase
      .from('threads')
      .insert({ user_id: userId, title })
      .select('id')
      .single()
    if (error) throw error
    threads = [
      {
        id: data.id,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      },
      ...threads,
    ]
    emit()
    return data.id
  }

  // local
  const id = uid()
  threads = [
    { id, title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] },
    ...threads,
  ]
  emit()
  return id
}

export async function addMessage(threadId, message) {
  const isFirst =
    (getThread(threadId)?.messages?.length ?? 0) === 0 &&
    message.role === 'user'
  const nextTitle = isFirst
    ? message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '')
    : null

  if (userId && isCloudEnabled) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        user_id: userId,
        role: message.role,
        content: message.content || '',
        image: message.image || null,
        model: message.model || null,
      })
      .select('id')
      .single()
    if (error) throw error
    if (nextTitle) {
      supabase.from('threads').update({ title: nextTitle }).eq('id', threadId)
    } else {
      // keep Recents ordering fresh (no DB trigger needed)
      supabase
        .from('threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId)
    }
    threads = threads.map((t) =>
      t.id === threadId
        ? {
            ...t,
            title: nextTitle || t.title,
            updatedAt: Date.now(),
            messages: [...t.messages, { id: data.id, ...message }],
          }
        : t
    )
    emit()
    return data.id
  }

  // local
  const msgId = uid()
  threads = threads.map((t) =>
    t.id === threadId
      ? {
          ...t,
          title: nextTitle || t.title,
          updatedAt: Date.now(),
          messages: [...t.messages, { id: msgId, ...message }],
        }
      : t
  )
  emit()
  return msgId
}

// In-memory only — used for live streaming updates (cheap, no DB writes).
export function updateMessage(threadId, msgId, content) {
  threads = threads.map((t) =>
    t.id === threadId
      ? {
          ...t,
          updatedAt: Date.now(),
          messages: t.messages.map((m) =>
            m.id === msgId ? { ...m, content } : m
          ),
        }
      : t
  )
  emit()
}

// Attach live tool-activity (search / code-run) to a message (in-memory only).
export function setMessageTools(threadId, msgId, tools) {
  threads = threads.map((t) =>
    t.id === threadId
      ? {
          ...t,
          messages: t.messages.map((m) =>
            m.id === msgId ? { ...m, tools } : m
          ),
        }
      : t
  )
  emit()
}

// Persist the final content of a message to the cloud once (call after streaming ends).
export async function persistMessageContent(msgId, content) {
  if (userId && isCloudEnabled) {
    await supabase.from('messages').update({ content }).eq('id', msgId)
  }
}

export async function deleteThread(id) {
  threads = threads.filter((t) => t.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('threads').delete().eq('id', id)
  }
}

export async function renameThread(id, title) {
  threads = threads.map((t) => (t.id === id ? { ...t, title } : t))
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('threads').update({ title }).eq('id', id)
  }
}

// Remove the given message and everything after it (used by edit/retry).
// In cloud mode, deletes those messages from the DB too.
export async function truncateFromMessage(threadId, msgId) {
  const t = getThread(threadId)
  if (!t) return []
  const idx = t.messages.findIndex((m) => m.id === msgId)
  if (idx === -1) return []
  const removed = t.messages.slice(idx)
  threads = threads.map((x) =>
    x.id === threadId ? { ...x, messages: x.messages.slice(0, idx) } : x
  )
  emit()
  if (userId && isCloudEnabled) {
    const ids = removed.map((m) => m.id).filter(Boolean)
    if (ids.length) {
      await supabase.from('messages').delete().in('id', ids)
    }
  }
  return removed
}

export function clearLocal() {
  threads = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  emit()
}

// ---- selectors ----
export function getThreads() {
  return threads
}
export function getThread(id) {
  return threads.find((t) => t.id === id) || null
}

// ---- React hooks ----
export function useThreads() {
  return useSyncExternalStore(subscribe, getThreads, getThreads)
}
export function useThread(id) {
  return useSyncExternalStore(
    subscribe,
    () => getThread(id),
    () => getThread(id)
  )
}
