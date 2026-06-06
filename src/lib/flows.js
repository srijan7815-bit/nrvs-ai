// Flow State missions store. Cloud-synced (Supabase, RLS) when logged in,
// localStorage in guest mode. Each flow = { id, objective, data(mission), ... }.
import { useSyncExternalStore } from 'react'
import { supabase, isCloudEnabled } from './supabase'

const LS_KEY = 'nrvs.flows.v1'

function uid() {
  return (
    (crypto?.randomUUID && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  )
}

let flows = []
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
    localStorage.setItem(LS_KEY, JSON.stringify(flows))
  } catch {
    /* ignore */
  }
}

export async function initFlowsForUser(id) {
  userId = id || null
  if (!userId || !isCloudEnabled) {
    flows = loadLocal()
    emit()
    return
  }
  try {
    const { data } = await supabase
      .from('flows')
      .select('id,objective,data,created_at,updated_at')
      .order('updated_at', { ascending: false })
    flows = (data || []).map((f) => ({
      id: f.id,
      objective: f.objective,
      data: f.data || {},
      createdAt: new Date(f.created_at).getTime(),
      updatedAt: new Date(f.updated_at).getTime(),
    }))
  } catch {
    flows = []
  }
  emit()
}

export async function createFlow(objective, mission) {
  const tempId = uid()
  const flow = {
    id: tempId,
    objective,
    data: mission || {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  flows = [flow, ...flows]
  emit()
  if (userId && isCloudEnabled) {
    try {
      const { data } = await supabase
        .from('flows')
        .insert({ user_id: userId, objective, data: mission || {} })
        .select('id')
        .single()
      if (data?.id) {
        flows = flows.map((f) => (f.id === tempId ? { ...f, id: data.id } : f))
        emit()
        return data.id
      }
    } catch {
      /* keep local */
    }
  }
  return tempId
}

export async function updateFlowData(id, mission) {
  flows = flows.map((f) =>
    f.id === id ? { ...f, data: mission, updatedAt: Date.now() } : f
  )
  emit()
  if (userId && isCloudEnabled) {
    supabase
      .from('flows')
      .update({ data: mission, updated_at: new Date().toISOString() })
      .eq('id', id)
  }
}

export async function deleteFlow(id) {
  flows = flows.filter((f) => f.id !== id)
  emit()
  if (userId && isCloudEnabled) {
    await supabase.from('flows').delete().eq('id', id)
  }
}

export function getFlow(id) {
  return flows.find((f) => f.id === id) || null
}
export function getFlows() {
  return flows
}
export function useFlows() {
  return useSyncExternalStore(subscribe, getFlows, getFlows)
}
export function useFlow(id) {
  return useSyncExternalStore(
    subscribe,
    () => getFlow(id),
    () => getFlow(id)
  )
}

// API call to generate a mission for an objective.
export async function generateMission(objective, model) {
  const res = await fetch('/api/flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objective, model }),
  })
  if (!res.ok) {
    let msg = 'Could not generate the mission.'
    try {
      msg = (await res.json())?.error || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const data = await res.json()
  return data.mission
}
