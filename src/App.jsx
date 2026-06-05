import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Home from './screens/Home'
import Thread from './screens/Thread'
import Settings from './screens/Settings'
import Placeholder from './screens/Placeholder'
import Login from './screens/Login'
import { useAuth } from './lib/auth'
import { initStoreForUser } from './lib/store'

/** Returns true if the visitor explicitly chose guest mode. */
function isGuest() {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).get('guest') === '1') {
    localStorage.setItem('nrvs.guest', '1')
  }
  return localStorage.getItem('nrvs.guest') === '1'
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-text-tertiary">
      <Loader2 className="animate-spin" />
    </div>
  )
}

/** Gate: requires auth (cloud) unless the user picked guest mode or cloud is disabled. */
function Protected({ children }) {
  const { user, loading, cloud } = useAuth()
  if (loading) return <FullScreenLoader />
  if (cloud && !user && !isGuest()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading, cloud } = useAuth()
  const location = useLocation()

  // Keep the data store in sync with the signed-in user (or guest/local).
  useEffect(() => {
    if (loading) return
    initStoreForUser(cloud ? user?.id ?? null : null)
  }, [user?.id, loading, cloud])

  return (
    <Routes>
      <Route
        path="/login"
        element={
          cloud && user ? <Navigate to="/" replace /> : <Login />
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Home />
          </Protected>
        }
      />
      <Route
        path="/thread/:id"
        element={
          <Protected>
            <Thread />
          </Protected>
        }
      />
      <Route
        path="/library"
        element={
          <Protected>
            <Placeholder
              title="Library"
              subtitle="Your saved prompts, files, and references live here."
            />
          </Protected>
        }
      />
      <Route
        path="/projects"
        element={
          <Protected>
            <Placeholder
              title="Projects"
              subtitle="Group related threads and artifacts into projects."
            />
          </Protected>
        }
      />
      <Route
        path="/artifacts"
        element={
          <Protected>
            <Placeholder
              title="Artifacts"
              subtitle="Generated documents, code, and assets appear here."
            />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
