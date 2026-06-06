// Simple projects store (cloud-synced via Supabase if a `projects` table exists,
// localStorage fallback). Projects are lightweight containers for now.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_KEY = 'nrvs.projects.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let projects = []
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
    localStorage.setItem(LS_KEY, JSON.stringify(projects))
  } catch {
    /* ignore */
  }
}

export async function initProjectsForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    projects = loadLocal()
    emit()
    return
  }
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id,name,description,created_at')
      .order('created_at', { ascending: false })
    if (error) {
      projects = loadLocal()
    } else {
      projects = (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: new Date(p.created_at).getTime(),
      }))
    }
  } catch {
    projects = loadLocal()
  }
  emit()
}

export async function createProject(name, description = '') {
  const n = (name || '').trim()
  if (!n) return null
  const tempId = uid()
  projects = [
    { id: tempId, name: n, description, createdAt: Date.now() },
    ...projects,
  ]
  emit()
  if (userId && isCloudEnabled) {
    try {
      const { data } = await supabase
        .from('projects')
        .insert({ user_id: userId, name: n, description })
        .select('id')
        .single()
      if (data?.id) {
        projects = projects.map((p) => (p.id === tempId ? { ...p, id: data.id } : p))
        emit()
      }
    } catch {
      persistLocal()
    }
  }
  return tempId
}

export async function deleteProject(id) {
  projects = projects.filter((p) => p.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('projects').delete().eq('id', id)
  }
}

export function getProjects() {
  return projects
}
export function useProjects() {
  return useSyncExternalStore(subscribe, getProjects, getProjects)
}
