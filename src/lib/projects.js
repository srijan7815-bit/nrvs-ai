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
  loadProjectFiles()
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
export function getProject(id) {
  return projects.find((p) => p.id === id) || null
}
export function useProjects() {
  return useSyncExternalStore(subscribe, getProjects, getProjects)
}

// ── project files (shared across the project's threads) ──
let projectFiles = [] // {id, projectId, name, content}
const fileListeners = new Set()
function emitFiles() {
  if (!userId) {
    try {
      localStorage.setItem('nrvs.projectFiles.v1', JSON.stringify(projectFiles))
    } catch {
      /* ignore */
    }
  }
  for (const l of fileListeners) l()
}
function subFiles(cb) {
  fileListeners.add(cb)
  return () => fileListeners.delete(cb)
}

export async function loadProjectFiles() {
  if (!userId || !isCloudEnabled) {
    try {
      projectFiles = JSON.parse(localStorage.getItem('nrvs.projectFiles.v1') || '[]')
    } catch {
      projectFiles = []
    }
    emitFiles()
    return
  }
  try {
    const { data } = await supabase
      .from('project_files')
      .select('id,project_id,name,content,created_at')
      .order('created_at', { ascending: false })
    projectFiles = (data || []).map((f) => ({
      id: f.id,
      projectId: f.project_id,
      name: f.name,
      content: f.content,
    }))
  } catch {
    projectFiles = []
  }
  emitFiles()
}

export async function addProjectFile(projectId, { name, content }) {
  const tempId = uid()
  projectFiles = [{ id: tempId, projectId, name, content: content || null }, ...projectFiles]
  emitFiles()
  if (userId && isCloudEnabled) {
    try {
      const { data } = await supabase
        .from('project_files')
        .insert({ user_id: userId, project_id: projectId, name, content: content || null })
        .select('id')
        .single()
      if (data?.id) {
        projectFiles = projectFiles.map((f) => (f.id === tempId ? { ...f, id: data.id } : f))
        emitFiles()
      }
    } catch {
      /* keep local */
    }
  }
}

export async function deleteProjectFile(id) {
  projectFiles = projectFiles.filter((f) => f.id !== id)
  emitFiles()
  if (userId && isCloudEnabled) {
    await supabase.from('project_files').delete().eq('id', id)
  }
}

export function filesForProject(projectId) {
  return projectFiles.filter((f) => f.projectId === projectId)
}
export function useProjectFiles() {
  return useSyncExternalStore(subFiles, () => projectFiles, () => projectFiles)
}
