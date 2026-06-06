import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { navItems, USER_INITIAL } from './nav'
import { useThreads, deleteThread } from '../lib/store'
import Wordmark from './Wordmark'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/profile'

/**
 * Shared sidebar body used by both the desktop fixed sidebar and the mobile overlay.
 * Brand, nav list, real Recents (persisted threads), user avatar + "New thread".
 */
export default function SidebarContent({ onNavigate }) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const threads = useThreads()
  const { user } = useAuth()
  const { name } = useProfile()
  const initial = (name || user?.email || USER_INITIAL).charAt(0).toUpperCase()

  const go = (to) => {
    navigate(to)
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-4 pt-5 pb-3">
        <button onClick={() => go('/')} aria-label="NRVS home">
          <Wordmark className="text-2xl" />
        </button>
      </div>

      {/* Nav */}
      <nav className="px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active =
            item.to === '/'
              ? location.pathname === '/' ||
                location.pathname.startsWith('/thread')
              : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.id}
              to={item.to}
              onClick={onNavigate}
              className={`nav-row ${active ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Recents (real persisted threads) */}
      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <div className="mb-1 px-3 text-caption font-medium uppercase tracking-wide text-text-tertiary">
          Recents
        </div>
        {threads.length === 0 ? (
          <p className="px-3 py-2 text-body-sm text-text-tertiary">
            No threads yet. Start a new one.
          </p>
        ) : (
          <div className="space-y-0.5">
            {threads.map((t) => {
              const active = params.id === t.id
              return (
                <div
                  key={t.id}
                  className={`group flex items-center gap-1 rounded-sm pr-1 transition-colors duration-200 ${
                    active ? 'bg-surface2' : 'hover:bg-border'
                  }`}
                >
                  <button
                    onClick={() => go(`/thread/${t.id}`)}
                    className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-body-sm ${
                      active ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteThread(t.id)
                      if (active) go('/')
                    }}
                    className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:text-danger group-hover:flex"
                    aria-label="Delete thread"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom: avatar (settings) + new thread */}
      <div className="mt-auto flex items-center gap-3 border-t border-border px-3 py-3">
        <button
          onClick={() => go('/settings')}
          aria-label="Open settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface2 text-body-sm font-medium text-text-primary ring-1 ring-border transition-colors duration-200 hover:bg-border"
        >
          {initial}
        </button>
        <button
          onClick={() => go('/')}
          className="btn-primary h-9 flex-1 px-4 text-body-sm"
        >
          <Plus size={16} strokeWidth={2} />
          New thread
        </button>
      </div>
    </div>
  )
}
