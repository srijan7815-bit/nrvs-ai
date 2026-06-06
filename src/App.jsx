import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Home from './screens/Home'
import Thread from './screens/Thread'
import Settings from './screens/Settings'
import Placeholder from './screens/Placeholder'
import Login from './screens/Login'
import Memory from './screens/Memory'
import SharedLinks from './screens/SharedLinks'
import SharedChat from './screens/SharedChat'
import { useAuth } from './lib/auth'
import { initStoreForUser } from './lib/store'
import { initMemoryForUser } from './lib/memory'
import { initProfile } from './lib/profile'
import { initSharesForUser } from './lib/shares'
import NameSetup from './components/NameSetup'

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
    const id = cloud ? user?.id ?? null : null
    initStoreForUser(id)
    initMemoryForUser(id)
    initProfile(cloud ? user : null)
    initSharesForUser(id)
  }, [user?.id, loading, cloud])

  return (
    <>
    {/* Ask logged-in users without a name to set one (Google users skip this). */}
    {!loading && cloud && user && <NameSetup />}
    <Routes>
      {/* Public, no-auth shared chat view */}
      <Route path="/share/:id" element={<SharedChat />} />
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
        path="/memory"
        element={
          <Protected>
            <Memory />
          </Protected>
        }
      />
      <Route
        path="/shared-links"
        element={
          <Protected>
            <SharedLinks />
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
    </>
  )
}
