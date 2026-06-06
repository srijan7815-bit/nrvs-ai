import { useEffect, useRef, useState } from 'react'
import { FolderPlus, Check, FolderOpen } from 'lucide-react'
import { useProjects, getProject } from '../lib/projects'
import { assignThreadToProject } from '../lib/store'
import { haptic } from '../lib/haptics'

/** Dropdown to add the current thread to a project (or remove it). */
export default function AddToProject({ threadId, currentProjectId }) {
  const projects = useProjects()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = currentProjectId ? getProject(currentProjectId) : null

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          haptic('light')
          setOpen((o) => !o)
        }}
        className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm text-text-secondary"
        title="Add to project"
      >
        {current ? <FolderOpen size={16} /> : <FolderPlus size={16} />}
        <span className="hidden max-w-[120px] truncate sm:inline">
          {current ? current.name : 'Project'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-md border border-border bg-surface p-1.5 shadow-2xl">
          <div className="px-2.5 py-1.5 text-caption uppercase tracking-wide text-text-tertiary">
            Add to project
          </div>
          {projects.length === 0 ? (
            <div className="px-2.5 py-2 text-body-sm text-text-tertiary">
              No projects yet. Create one in Projects.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {projects.map((p) => {
                const active = p.id === currentProjectId
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      assignThreadToProject(threadId, active ? null : p.id)
                      haptic('select')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-body-sm text-text-secondary transition-colors hover:bg-border hover:text-text-primary"
                  >
                    <FolderOpen size={15} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {active && <Check size={15} className="text-accent-blue" />}
                  </button>
                )
              })}
            </div>
          )}
          {current && (
            <button
              onClick={() => {
                assignThreadToProject(threadId, null)
                setOpen(false)
              }}
              className="mt-1 w-full rounded-sm px-2.5 py-2 text-left text-body-sm text-danger transition-colors hover:bg-border"
            >
              Remove from project
            </button>
          )}
        </div>
      )}
    </div>
  )
}
