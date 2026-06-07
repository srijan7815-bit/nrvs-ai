import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import {
  ChevronLeft,
  Workflow,
  Map,
  ListChecks,
  Search,
  FileText,
  CalendarClock,
  Target,
  Plus,
  Trash2,
  Circle,
  CircleDot,
  CheckCircle2,
  Loader2,
  Play,
  Square,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  AppWindow,
} from 'lucide-react'
import Layout from '../components/Layout'
import Markdown from '../lib/markdown.jsx'
import { useFlow, updateFlowData } from '../lib/flows'
import { useFlowRunner } from '../lib/useFlowRunner'
import { usePrefs } from '../lib/prefs'
import { useArtifacts, parseCodeBlocks, compileArtifact } from '../lib/artifacts'
import { useConfirm } from '../lib/useConfirm'
import { haptic } from '../lib/haptics'

const PRIORITY_COLOR = { high: 'text-danger', medium: 'text-accent-orange', low: 'text-text-tertiary' }
const STATUS_CYCLE = { todo: 'doing', doing: 'done', done: 'todo' }
const STATUS_ICON = { todo: Circle, doing: CircleDot, done: CheckCircle2 }

function Panel({ icon: Icon, title, accent, children }) {
  return (
    <div className="card rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className={accent || 'text-accent-blue'} />
        <h2 className="text-body font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// Expandable "result" block with copy + optional open-as-artifact.
function ResultBlock({ text }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const { openArtifact } = useArtifacts()
  if (!text) return null

  const blocks = parseCodeBlocks(text)
  const previewable = blocks.some((b) =>
    ['html', 'htm', 'css', 'js', 'javascript', 'svg'].includes((b.language || '').toLowerCase())
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-1.5 rounded-md border border-border bg-bg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-caption text-accent-blue"
      >
        <Sparkles size={12} />
        {open ? 'Hide result' : 'View result'}
        <ChevronDown
          size={12}
          className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          <div className="max-h-72 overflow-y-auto text-body-sm">
            <Markdown text={text} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary hover:bg-border hover:text-text-primary"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} Copy
            </button>
            {previewable && (
              <button
                onClick={() =>
                  openArtifact({
                    type: 'html',
                    title: 'Preview',
                    content: compileArtifact(blocks),
                    files: blocks.map((b, i) => ({
                      name: b.filename || `${b.language || 'file'}-${i + 1}`,
                      language: b.language,
                      code: b.code,
                    })),
                  })
                }
                className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-caption text-text-tertiary hover:bg-border hover:text-text-primary"
              >
                <AppWindow size={12} /> Open preview
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MissionControl() {
  const { id } = useParams()
  const navigate = useNavigate()
  const flow = useFlow(id)
  const [prefs] = usePrefs()
  const { run, stop, running, current, error } = useFlowRunner(id, prefs.model)
  const [confirm, confirmUI] = useConfirm()
  const [newTask, setNewTask] = useState('')

  if (!flow) return <Navigate to="/flows" replace />
  const m = flow.data || {}
  const status = m.status || 'review'

  const save = (patch) => updateFlowData(id, { ...m, ...patch })

  const tasks = m.tasks || []
  const done = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0

  const cycleTask = (i) => {
    haptic('select')
    save({ tasks: tasks.map((t, j) => (j === i ? { ...t, status: STATUS_CYCLE[t.status] || 'todo' } : t)) })
  }
  const addTask = (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    save({ tasks: [...tasks, { title: newTask.trim(), status: 'todo', priority: 'medium' }] })
    setNewTask('')
  }
  const delTask = (i) => save({ tasks: tasks.filter((_, j) => j !== i) })
  const delResearch = (i) => save({ research: m.research.filter((_, j) => j !== i) })
  const delDoc = (i) => save({ documents: m.documents.filter((_, j) => j !== i) })

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-2 sm:px-6 lg:pt-6">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <button
            onClick={() => navigate('/flows')}
            className="btn-icon mt-0.5 h-9 w-9 border-transparent bg-transparent"
            aria-label="Back"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Workflow size={18} className="text-accent-orange" />
              <h1 className="min-w-0 truncate text-heading-md font-semibold">
                {m.title || flow.objective}
              </h1>
            </div>
            {m.summary && <p className="mt-1 text-body-sm text-text-tertiary">{m.summary}</p>}
          </div>
        </div>

        {/* Control banner */}
        {status === 'review' && !running && (
          <div className="card mb-5 flex flex-col gap-3 rounded-lg border-accent-orange/30 bg-accent-orange/5 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-body font-medium text-text-primary">Review the plan</div>
              <p className="text-body-sm text-text-tertiary">
                Edit anything below, then let NRVS work the plan autonomously.
              </p>
            </div>
            <button onClick={run} className="btn-primary h-10 shrink-0 px-5 text-body-sm">
              <Play size={16} /> Go on — let NRVS work
            </button>
          </div>
        )}
        {running && (
          <div className="card mb-5 flex items-center gap-3 rounded-lg border-accent-blue/30 bg-accent-blue/5 p-4">
            <Loader2 size={18} className="animate-spin text-accent-blue" />
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium text-text-primary">NRVS is working…</div>
              <p className="truncate text-body-sm text-text-tertiary">
                {current ? `${current.kind}: ${current.title}` : 'Starting…'}
              </p>
            </div>
            <button onClick={stop} className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm">
              <Square size={12} fill="currentColor" /> Stop
            </button>
          </div>
        )}
        {status === 'done' && !running && (
          <div className="card mb-5 flex items-center gap-3 rounded-lg border-accent-blue/30 bg-accent-blue/5 p-4">
            <CheckCircle2 size={18} className="text-accent-blue" />
            <div className="flex-1 text-body font-medium text-text-primary">
              Mission complete — NRVS worked through the plan.
            </div>
            <button onClick={run} className="btn-icon flex h-9 items-center gap-1.5 px-3 text-body-sm">
              <Play size={14} /> Re-run
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-body-sm text-danger">
            {error}
          </div>
        )}

        {/* Progress */}
        <div className="card mb-5 rounded-lg p-4">
          <div className="mb-2 flex items-center justify-between text-body-sm">
            <span className="font-medium text-text-primary">Progress</span>
            <span className="text-text-tertiary">{done}/{tasks.length} tasks · {pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-pill bg-surface2">
            <div className="h-full rounded-pill bg-accent-orange transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Tasks */}
          <Panel icon={ListChecks} title="Tasks" accent="text-accent-orange">
            <div className="space-y-1.5">
              {tasks.map((t, i) => {
                const Icon = STATUS_ICON[t.status] || Circle
                const active = running && current?.kind === 'task' && current?.title === t.title
                return (
                  <div key={i} className="group rounded-sm px-1 py-1 hover:bg-border/40">
                    <div className="flex items-center gap-2">
                      <button onClick={() => cycleTask(i)} className="shrink-0">
                        {active ? (
                          <Loader2 size={16} className="animate-spin text-accent-orange" />
                        ) : (
                          <Icon
                            size={16}
                            className={
                              t.status === 'done'
                                ? 'text-accent-blue'
                                : t.status === 'doing'
                                ? 'text-accent-orange'
                                : 'text-text-tertiary'
                            }
                          />
                        )}
                      </button>
                      <span className={`min-w-0 flex-1 text-body-sm ${t.status === 'done' ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                        {t.title}
                      </span>
                      <span className={`text-caption ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                      <button onClick={() => delTask(i)} className="hidden text-text-tertiary hover:text-danger group-hover:block">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="pl-6">
                      <ResultBlock text={t.result} />
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={addTask} className="mt-3 flex gap-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Add a task…"
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button type="submit" className="btn-icon h-9 w-9"><Plus size={16} /></button>
            </form>
          </Panel>

          {/* Roadmap */}
          <Panel icon={Map} title="Roadmap">
            <ol className="space-y-3">
              {(m.roadmap || []).map((p, i) => (
                <li key={i} className="relative pl-6">
                  <span className="absolute left-0 top-0.5 flex h-4 w-4 items-center justify-center rounded-pill bg-accent-blue/20 text-[10px] font-semibold text-accent-blue">{i + 1}</span>
                  <div className="text-body-sm font-medium text-text-primary">{p.phase}</div>
                  <div className="text-caption text-text-tertiary">{p.goal}</div>
                </li>
              ))}
            </ol>
          </Panel>

          {/* Timeline */}
          <Panel icon={CalendarClock} title="Timeline">
            <div className="space-y-2.5">
              {(m.timeline || []).map((t, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-20 shrink-0 text-caption font-medium text-accent-blue">{t.when}</span>
                  <span className="text-body-sm text-text-secondary">{t.milestone}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Metrics */}
          <Panel icon={Target} title="Success Metrics">
            <div className="space-y-2">
              {(m.metrics || []).map((mt, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-body-sm text-text-primary">{mt.name}</span>
                  <span className="text-caption text-accent-orange">{mt.target}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Research */}
          <Panel icon={Search} title="Research Board">
            <div className="space-y-2">
              {(m.research || []).map((r, i) => {
                const active = running && current?.kind === 'research' && current?.title === r.topic
                return (
                  <div key={i} className="group rounded-md border border-border bg-surface px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {active && <Loader2 size={12} className="animate-spin text-accent-orange" />}
                        <div className="text-body-sm font-medium text-text-primary">{r.topic}</div>
                      </div>
                      <button onClick={() => delResearch(i)} className="hidden shrink-0 text-text-tertiary hover:text-danger group-hover:block">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {r.note && <div className="text-caption text-text-tertiary">{r.note}</div>}
                    <ResultBlock text={r.result} />
                  </div>
                )
              })}
            </div>
          </Panel>

          {/* Documents */}
          <Panel icon={FileText} title="Documents">
            <div className="space-y-2">
              {(m.documents || []).map((d, i) => {
                const active = running && current?.kind === 'document' && current?.title === d.name
                return (
                  <div key={i} className="group rounded-md border border-border bg-surface px-3 py-2">
                    <div className="flex items-start gap-2">
                      {active ? (
                        <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-accent-orange" />
                      ) : (
                        <FileText size={15} className="mt-0.5 shrink-0 text-text-secondary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-body-sm font-medium text-text-primary">{d.name}</div>
                        <div className="text-caption text-text-tertiary">{d.purpose}</div>
                      </div>
                      <button onClick={() => delDoc(i)} className="hidden shrink-0 text-text-tertiary hover:text-danger group-hover:block">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <ResultBlock text={d.content} />
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
      </div>
      {confirmUI}
    </Layout>
  )
}
