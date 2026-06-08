import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Home from './screens/Home'
import Thread from './screens/Thread'
import Settings from './screens/Settings'
import Login from './screens/Login'
import Memory from './screens/Memory'
import SharedLinks from './screens/SharedLinks'
import SharedChat from './screens/SharedChat'
import Library from './screens/Library'
import Projects from './screens/Projects'
import ProjectDetail from './screens/ProjectDetail'
import Secrets from './screens/Secrets'
import ApiKeys from './screens/ApiKeys'
import Flows from './screens/Flows'
import MissionControl from './screens/MissionControl'
import PrivacyPolicy from './screens/PrivacyPolicy'
import TermsOfService from './screens/TermsOfService'
import CookiePolicy from './screens/CookiePolicy'
import { useAuth } from './lib/auth'
import { initStoreForUser } from './lib/store'
import { initMemoryForUser } from './lib/memory'
import { initProfile } from './lib/profile'
import { initSharesForUser } from './lib/shares'
import { initLibraryForUser } from './lib/library'
import { initSecretsForUser } from './lib/secrets'
import { initProjectsForUser } from './lib/projects'
import { initApiKeysForUser } from './lib/apikeys'
import { initFlowsForUser } from './lib/flows'
import Onboarding from './components/Onboarding'

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-text-tertiary">
      <Loader2 className="animate-spin" />
    </div>
  )
}

/** Gate: requires auth when cloud mode is enabled. */
function Protected({ children }) {
  const { user, loading, cloud } = useAuth()
  if (loading) return <FullScreenLoader />
  if (cloud && !user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading, cloud } = useAuth()
  const location = useLocation()

  // Keep the data store in sync with the signed-in user.
  // NOTE: we depend on `user` (not user?.id) so that the effect re-runs
  // whenever the user object changes — including when it goes from null
  // (session loading) to a real user (session ready).
  // The `if (loading)` guard is still important: we skip ALL init calls
  // while Supabase is still restoring the session so we don't pass a
  // stale user to initProfile.
  useEffect(() => {
    if (loading) return
    if (!user) return

    const id = user.id
    initStoreForUser(id)
    initMemoryForUser(id)
    initSharesForUser(id)
    initLibraryForUser(id)
    initSecretsForUser(id)
    initProjectsForUser(id)
    initApiKeysForUser(id)
    initFlowsForUser(id)

    // initProfile needs the Google/OAuth display name (available synchronously
    // from the user object) so it can pre-fill the name step for Google users.
    const metaName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      null
    initProfile(user, metaName)
  }, [user, loading, cloud])

  return (
    <>
    {/* Ask logged-in users who haven't onboarded yet to set a name and consent. */}
    {!loading && cloud && user && <Onboarding />}
    <Routes>
      {/* Public, no-auth shared chat view */}
      <Route path="/share/:id" element={<SharedChat />} />

      {/* Legal pages — public */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/cookies" element={<CookiePolicy />} />

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
            <Library />
          </Protected>
        }
      />
      <Route
        path="/projects"
        element={
          <Protected>
            <Projects />
          </Protected>
        }
      />
      <Route
        path="/project/:id"
        element={
          <Protected>
            <ProjectDetail />
          </Protected>
        }
      />
      <Route
        path="/artifacts"
        element={
          <Protected>
            <Library />
          </Protected>
        }
      />
      <Route
        path="/flows"
        element={
          <Protected>
            <Flows />
          </Protected>
        }
      />
      <Route
        path="/flow/:id"
        element={
          <Protected>
            <MissionControl />
          </Protected>
        }
      />
      <Route
        path="/secrets"
        element={
          <Protected>
            <Secrets />
          </Protected>
        }
      />
      <Route
        path="/api-keys"
        element={
          <Protected>
            <ApiKeys />
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