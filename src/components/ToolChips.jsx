import { Search, Terminal, Loader2, Check } from 'lucide-react'

/** Renders the search / code-run activity that happened during a reply. */
export default function ToolChips({ tools }) {
  if (!tools || !tools.length) return null

  // collapse start/done pairs into one chip per call
  const calls = []
  for (const e of tools) {
    if (e.status === 'start') {
      calls.push({ tool: e.tool, args: e.args, done: false, result: null })
    } else if (e.status === 'done') {
      const last = [...calls].reverse().find((c) => c.tool === e.tool && !c.done)
      if (last) {
        last.done = true
        last.result = e.result
      } else {
        calls.push({ tool: e.tool, args: e.args, done: true, result: e.result })
      }
    }
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {calls.map((c, i) => {
        const Icon = c.tool === 'web_search' ? Search : Terminal
        const label =
          c.tool === 'web_search'
            ? `Searched: ${c.args?.query || ''}`
            : `Ran ${c.args?.language || 'code'}`
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface2 px-2.5 py-1 text-caption text-text-secondary"
            title={label}
          >
            <Icon size={12} strokeWidth={1.75} />
            <span className="max-w-[220px] truncate">{label}</span>
            {c.done ? (
              <Check size={12} className="text-accent-blue" />
            ) : (
              <Loader2 size={12} className="animate-spin" />
            )}
          </span>
        )
      })}
    </div>
  )
}
