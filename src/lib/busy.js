// Global "is generating" state, shared across screens so the thinking animation
// shows even right after navigating to a freshly-created thread.
import { useSyncExternalStore } from 'react'

const busyThreads = new Set()
let errorMsg = null
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setBusy(threadId, on) {
  if (!threadId) return
  if (on) busyThreads.add(threadId)
  else busyThreads.delete(threadId)
  emit()
}
export function setError(msg) {
  errorMsg = msg || null
  emit()
}
export function isThreadBusy(threadId) {
  return busyThreads.has(threadId)
}
export function isAnyBusy() {
  return busyThreads.size > 0
}

// snapshot string so useSyncExternalStore re-renders on change
function snapshot() {
  return [...busyThreads].sort().join(',') + '|' + (errorMsg || '')
}

export function useBusy(threadId) {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  return {
    busy: threadId ? busyThreads.has(threadId) : busyThreads.size > 0,
    error: errorMsg,
  }
}
