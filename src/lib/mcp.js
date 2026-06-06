// MCP (Model Context Protocol) server registry — managed in Settings.
// Stored locally (and could be synced later). Each server: { id, name, url, enabled }.
import { useSyncExternalStore } from 'react'

const KEY = 'nrvs.mcp.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let servers = load()
const listeners = new Set()

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(servers))
  } catch {
    /* ignore */
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

export function addServer({ name, url }) {
  const clean = (url || '').trim()
  if (!clean) return null
  servers = [
    { id: uid(), name: (name || clean).trim(), url: clean, enabled: true },
    ...servers,
  ]
  emit()
}
export function removeServer(id) {
  servers = servers.filter((s) => s.id !== id)
  emit()
}
export function toggleServer(id) {
  servers = servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
  emit()
}
export function getServers() {
  return servers
}
export function useMcpServers() {
  return useSyncExternalStore(subscribe, getServers, getServers)
}
