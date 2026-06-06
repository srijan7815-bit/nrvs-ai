import { useNavigate } from 'react-router-dom'
import { Workflow, Trash2, Target } from 'lucide-react'
import Layout from '../components/Layout'
import { useFlows, deleteFlow } from '../lib/flows'
import { useConfirm } from '../lib/useConfirm'

export default function Flows() {
  const navigate = useNavigate()
  const flows = useFlows()
  const [confirm, confirmUI] = useConfirm()

  const askDelete = async (f) => {
    const ok = await confirm({
      title: 'Delete mission?',
      message: `“${f.data?.title || f.objective}” will be permanently deleted.`,
    })
    if (ok) deleteFlow(f.id)
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 sm:px-6 lg:pt-8">
        <div className="mb-1 flex items-center gap-2">
          <Workflow size={20} className="text-accent-orange" />
          <h1 className="text-heading-lg font-semibold">Flow State</h1>
        </div>
        <p className="mb-6 text-body-sm text-text-tertiary">
          Mission-control workspaces NRVS built from your objectives. Enable
          “Flow State” next to the model picker, then give NRVS an objective.
        </p>

        {flows.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 rounded-md py-12 text-center">
            <Target size={28} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">No missions yet</p>
            <p className="text-body-sm text-text-tertiary">
              Turn on Flow State and tell NRVS something like “Build my AI startup”.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {flows.map((f) => {
              const tasks = f.data?.tasks || []
              const done = tasks.filter((t) => t.status === 'done').length
              const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0
              return (
                <div key={f.id} className="card card-hover rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => navigate(`/flow/${f.id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-body font-medium text-text-primary">
                        {f.data?.title || f.objective}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-body-sm text-text-tertiary">
                        {f.data?.summary || f.objective}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-28 overflow-hidden rounded-pill bg-surface2">
                          <div
                            className="h-full rounded-pill bg-accent-orange"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-caption text-text-tertiary">
                          {done}/{tasks.length} · {pct}%
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => askDelete(f)}
                      className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-danger"
                      aria-label="Delete mission"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {confirmUI}
    </Layout>
  )
}
