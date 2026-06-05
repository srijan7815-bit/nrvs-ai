// Lightweight thread store backed by localStorage + a React hook with subscriptions.
import { useSyncExternalStore } from 'react'

const KEY = 'nrvs.threads.v1'

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function load() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

let threads = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads))
  } catch {
    /* ignore quota */
  }
}

function emit() {
  persist()
  for (const l of listeners) l()
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---- public API ----

export function getThreads() {
  return threads
}

export function getThread(id) {
  return threads.find((t) => t.id === id) || null
}

export function createThread(firstMessage) {
  const id = uid()
  const title = firstMessage
    ? firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '…' : '')
    : 'New thread'
  const thread = {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  }
  threads = [thread, ...threads]
  emit()
  return id
}

export function addMessage(id, message) {
  const msgId = uid()
  threads = threads.map((t) =>
    t.id === id
      ? {
          ...t,
          updatedAt: Date.now(),
          title:
            t.messages.length === 0 && message.role === 'user'
              ? message.content.slice(0, 40) +
                (message.content.length > 40 ? '…' : '')
              : t.title,
          messages: [...t.messages, { id: msgId, ...message }],
        }
      : t
  )
  emit()
  return msgId
}

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

export function deleteThread(id) {
  threads = threads.filter((t) => t.id !== id)
  emit()
}

export function renameThread(id, title) {
  threads = threads.map((t) => (t.id === id ? { ...t, title } : t))
  emit()
}

// React hooks
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
