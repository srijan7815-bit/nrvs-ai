// Shared-chat links. Cloud-backed (Supabase) when logged in; falls back to
// localStorage in guest mode (links only work on the same browser then).
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'
import { getThread } from './store'

const LS_KEY = 'nrvs.shares.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let shares = []
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
    localStorage.setItem(LS_KEY, JSON.stringify(shares))
  } catch {
    /* ignore */
  }
}

function threadSnapshot(thread) {
  return {
    title: thread.title,
    messages: (thread.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      image: m.image || null,
      model: m.model || null,
    })),
  }
}

export async function initSharesForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    shares = loadLocal()
    emit()
    return
  }
  const { data } = await supabase
    .from('shared_chats')
    .select('id,thread_id,title,mode,created_at')
    .order('created_at', { ascending: false })
  shares = (data || []).map((s) => ({
    id: s.id,
    threadId: s.thread_id,
    title: s.title,
    mode: s.mode,
    createdAt: new Date(s.created_at).getTime(),
  }))
  emit()
}

// Create a share for a thread. mode = 'snapshot' | 'live'. Returns the share id.
export async function createShare(threadId, mode = 'snapshot') {
  const thread = getThread(threadId)
  if (!thread) return null
  const snap = threadSnapshot(thread)

  if (userId && isCloudEnabled) {
    const { data, error } = await supabase
      .from('shared_chats')
      .insert({
        user_id: userId,
        thread_id: threadId,
        title: thread.title,
        mode,
        snapshot: snap,
      })
      .select('id')
      .single()
    if (error) return null
    shares = [
      { id: data.id, threadId, title: thread.title, mode, createdAt: Date.now() },
      ...shares,
    ]
    emit()
    return data.id
  }

  const id = uid()
  shares = [
    { id, threadId, title: thread.title, mode, snapshot: snap, createdAt: Date.now() },
    ...shares,
  ]
  emit()
  return id
}

// Re-sync a live share's snapshot to the thread's current messages.
export async function syncLiveShares(threadId) {
  const thread = getThread(threadId)
  if (!thread) return
  const live = shares.filter((s) => s.threadId === threadId && s.mode === 'live')
  if (!live.length) return
  const snap = threadSnapshot(thread)
  if (userId && isCloudEnabled) {
    for (const s of live) {
      supabase
        .from('shared_chats')
        .update({ snapshot: snap, title: thread.title, updated_at: new Date().toISOString() })
        .eq('id', s.id)
    }
  } else {
    shares = shares.map((s) =>
      s.threadId === threadId && s.mode === 'live'
        ? { ...s, snapshot: snap, title: thread.title }
        : s
    )
    emit()
  }
}

export async function deleteShare(id) {
  shares = shares.filter((s) => s.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('shared_chats').delete().eq('id', id)
  }
}

// Public fetch (no auth) for the /share/:id page.
export async function fetchSharedChat(id) {
  if (isCloudEnabled) {
    const { data, error } = await supabase
      .from('shared_chats')
      .select('title,mode,snapshot')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return { title: data.title, messages: data.snapshot?.messages || [] }
  }
  // guest/local fallback
  const local = loadLocal().find((s) => s.id === id)
  return local ? { title: local.title, messages: local.snapshot?.messages || [] } : null
}

export function getShares() {
  return shares
}
export function sharesForThread(threadId) {
  return shares.filter((s) => s.threadId === threadId)
}
export function useShares() {
  return useSyncExternalStore(subscribe, getShares, getShares)
}
