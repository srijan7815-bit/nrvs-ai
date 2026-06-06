import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from '../components/Layout'
import { useProjects, createProject, deleteProject } from '../lib/projects'
import { haptic } from '../lib/haptics'
import { useConfirm } from '../lib/useConfirm'

export default function Projects() {
  const navigate = useNavigate()
  const projects = useProjects()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [confirm, confirmUI] = useConfirm()

  const askDelete = async (p) => {
    const ok = await confirm({
      title: 'Delete project?',
      message: `“${p.name}” will be deleted. Threads inside it won’t be removed.`,
    })
    if (ok) deleteProject(p.id)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    haptic('success')
    await createProject(name, desc)
    setName('')
    setDesc('')
    setOpen(false)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:px-6 lg:pt-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-heading-lg font-semibold">Projects</h1>
            <p className="text-body-sm text-text-tertiary">
              Group related threads and artifacts.
            </p>
          </div>
          <button
            onClick={() => {
              haptic('light')
              setOpen(true)
            }}
            className="btn-primary h-10 shrink-0 px-4 text-body-sm"
          >
            <Plus size={16} /> Create project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-12 text-center">
            <FolderOpen size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No projects yet</p>
            <p className="text-body-sm text-text-tertiary">
              Create your first project to organize your work.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <div key={p.id} className="card card-hover rounded-md p-4">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => navigate(`/project/${p.id}`)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <FolderOpen size={18} className="mt-0.5 text-accent-orange" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body font-medium text-text-primary">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="mt-0.5 line-clamp-2 text-body-sm text-text-tertiary">
                          {p.description}
                        </div>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => askDelete(p)}
                    className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-danger"
                    aria-label="Delete project"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.form
              onSubmit={submit}
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-heading-md font-semibold">New project</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-icon h-8 w-8"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="mb-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="mb-4 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="btn-primary h-11 w-full text-body disabled:opacity-40"
              >
                Create project
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      {confirmUI}
    </Layout>
  )
}
