import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  User,
  CreditCard,
  SlidersHorizontal,
  Shield,
  Sun,
  Type,
  Mic,
  Smartphone,
  Lock,
  Link as LinkIcon,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import Toggle from '../components/Toggle'
import Layout from '../components/Layout'
import { usePrefs } from '../lib/prefs'
import { getThreads, deleteThread } from '../lib/store'

function Row({ icon: Icon, label, sub, danger, right, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card card-hover flex w-full items-center gap-3 px-4 py-3 text-left ${
        danger ? 'text-danger' : 'text-text-primary'
      }`}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        className={danger ? 'text-danger' : 'text-text-secondary'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-body">{label}</div>
        {sub && <div className="text-body-sm text-text-tertiary">{sub}</div>}
      </div>
      {right ?? (
        <ChevronRight size={16} className="text-text-tertiary" strokeWidth={1.75} />
      )}
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const [prefs, setPref] = usePrefs()

  const handleLogout = () => {
    if (
      window.confirm(
        'Log out? This will clear your local threads and preferences on this device.'
      )
    ) {
      getThreads()
        .map((t) => t.id)
        .forEach((id) => deleteThread(id))
      try {
        localStorage.removeItem('nrvs.prefs.v1')
      } catch {
        /* ignore */
      }
      navigate('/')
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-2 sm:px-6 lg:pt-8">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-icon h-9 w-9 border-transparent bg-transparent"
            aria-label="Back"
          >
            <ChevronLeft size={20} strokeWidth={1.75} />
          </button>
          <h1 className="text-heading-md font-semibold">Settings</h1>
        </div>

        {/* Account row */}
        <div className="card mb-4 flex items-center justify-between px-4 py-3">
          <span className="text-body text-text-secondary">
            nelbachira1975@gmail.com
          </span>
          <span className="rounded-pill border border-border px-3 py-1 text-body-sm text-text-secondary">
            Free
          </span>
        </div>

        {/* Upgrade card */}
        <div className="card mb-4 p-4">
          <div className="text-body font-medium">Want more NRVS?</div>
          <p className="mt-1 text-body-sm text-text-tertiary">
            Upgrade for more usage and capabilities.
          </p>
          <button className="btn-primary mt-3 h-9 px-5 text-body-sm">
            Upgrade
          </button>
        </div>

        {/* Profile / Billing */}
        <div className="mb-4 space-y-2">
          <Row icon={User} label="Profile" />
          <Row icon={CreditCard} label="Billing" />
        </div>

        {/* Capabilities / Permissions */}
        <div className="mb-4 space-y-2">
          <Row icon={SlidersHorizontal} label="Capabilities" sub="3 enabled" />
          <Row icon={Shield} label="Permissions" sub="1 enabled" />
        </div>

        {/* Preferences */}
        <div className="mb-4 space-y-2">
          <Row
            icon={Sun}
            label="Color mode"
            sub={prefs.colorMode}
            onClick={() =>
              setPref(
                'colorMode',
                prefs.colorMode === 'System'
                  ? 'Dark'
                  : prefs.colorMode === 'Dark'
                  ? 'Light'
                  : 'System'
              )
            }
          />
          <Row
            icon={Type}
            label="Font style"
            sub={prefs.fontStyle}
            onClick={() =>
              setPref(
                'fontStyle',
                prefs.fontStyle === 'Default' ? 'Serif' : 'Default'
              )
            }
          />
          <Row icon={Mic} label="Voice" />
          <Row
            icon={Smartphone}
            label="Haptic feedback"
            right={
              <Toggle
                checked={prefs.haptic}
                onChange={(v) => setPref('haptic', v)}
                label="Haptic feedback"
              />
            }
            onClick={() => setPref('haptic', !prefs.haptic)}
          />
          <Row icon={Lock} label="Privacy" />
          <Row icon={LinkIcon} label="Shared links" />
        </div>

        {/* Logout */}
        <Row
          icon={LogOut}
          label="Log out"
          danger
          right={<span />}
          onClick={handleLogout}
        />
      </div>
    </Layout>
  )
}
