import { useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ChevronLeft,
  FolderOpen,
  Plus,
  Upload,
  FileText,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  getProject,
  useProjects,
  useProjectFiles,
  filesForProject,
  addProjectFile,
  deleteProjectFile,
} from '../lib/projects'
import { useThreads, createThread, assignThreadToProject } from '../lib/store'
import { useConfirm } from '../lib/useConfirm'
import { haptic } from '../lib/haptics'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  useProjects() // subscribe
  useProjectFiles() // subscribe
  const threads = useThreads()
  const fileRef = useRef(null)
  const [confirm, confirmUI] = useConfirm()

  const project = getProject(id)
  if (!project) return <Navigate to="/projects" replace />

  const files = filesForProject(id)
  const projThreads = threads.filter((t) => t.projectId === id)

  const onUpload = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type.startsWith('video/')) {
      alert('Video files are not supported.')
      e.target.value = ''
      return
    }
    const TEXT_MAX = 200 * 1024
    const looksText =
      f.type.startsWith('text/') ||
      /\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|xml|yaml|yml|log|sh|java|c|cpp|go|rb|rs|php|sql)$/i.test(f.name)
    if (looksText && f.size <= TEXT_MAX) {
      const reader = new FileReader()
      reader.onload = () => addProjectFile(id, { name: f.name, content: String(reader.result) })
      reader.readAsText(f)
    } else {
      addProjectFile(id, { name: f.name, content: null })
    }
    e.target.value = ''
    haptic('success')
  }

  const newThread = async () => {
    haptic('light')
    const tid = await createThread('New thread')
    await assignThreadToProject(tid, id)
    navigate(`/thread/${tid}`)
  }

  const askDeleteFile = async (f) => {
    const ok = await confirm({
      title: 'Delete file?',
      message: `“${f.name}” will be removed from this project.`,
    })
    if (ok) deleteProjectFile(f.id)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-2 sm:px-6 lg:pt-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="btn-icon h-9 w-9 border-transparent bg-transparent"
            aria-label="Back"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <FolderOpen size={20} className="text-accent-orange" />
          <h1 className="min-w-0 flex-1 truncate text-heading-md font-semibold">
            {project.name}
          </h1>
        </div>
        {project.description && (
          <p className="mb-5 text-body-sm text-text-tertiary">{project.description}</p>
        )}

        {/* Files */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-body font-medium text-text-primary">Files</h2>
            <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-icon flex h-8 items-center gap-1.5 px-3 text-body-sm"
            >
              <Upload size={14} /> Upload
            </button>
          </div>
          <p className="mb-2 text-caption text-text-tertiary">
            All threads in this project share these files & context.
          </p>
          {files.length === 0 ? (
            <div className="card rounded-md px-4 py-6 text-center text-body-sm text-text-tertiary">
              No files yet.
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="card flex items-center gap-3 rounded-md px-3 py-2">
                  <FileText size={16} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-text-primary">
                    {f.name}
                  </span>
                  {!f.content && (
                    <span className="text-caption text-text-tertiary">binary</span>
                  )}
                  <button
                    onClick={() => askDeleteFile(f)}
                    className="rounded-sm p-1 text-text-tertiary hover:text-danger"
                    aria-label="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Threads */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-body font-medium text-text-primary">Threads</h2>
            <button
              onClick={newThread}
              className="btn-primary h-8 px-3 text-body-sm"
            >
              <Plus size={14} /> New thread
            </button>
          </div>
          {projThreads.length === 0 ? (
            <div className="card rounded-md px-4 py-6 text-center text-body-sm text-text-tertiary">
              No threads in this project yet. Create one here, or add an existing
              thread from its chat screen.
            </div>
          ) : (
            <div className="space-y-2">
              {projThreads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/thread/${t.id}`)}
                  className="card card-hover flex w-full items-center gap-3 rounded-md px-4 py-3 text-left"
                >
                  <MessageSquare size={16} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                    {t.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirmUI}
    </Layout>
  )
}
