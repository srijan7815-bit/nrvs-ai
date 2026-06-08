import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  User,
  SlidersHorizontal,
  Shield,
  Sun,
  Mic,
  Smartphone,
  Link as LinkIcon,
  LogOut,
  ChevronRight,
  Check,
  Server,
  Plus,
  Trash2,
  Brain,
  KeyRound,
  Code2,
} from 'lucide-react'
import Toggle from '../components/Toggle'
import Layout from '../components/Layout'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePrefs } from '../lib/prefs'

import { useAuth } from '../lib/auth'
import { useProfile, saveName } from '../lib/profile'
import { FONT_OPTIONS } from '../lib/fonts'
import { hapticTest, haptic } from '../lib/haptics'
import {
  useMcpServers,
  addServer,
  removeServer,
  toggleServer,
} from '../lib/mcp'

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

function SectionTitle({ children }) {
  return (
    <div className="mb-2 mt-6 px-1 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
      {children}
    </div>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const [prefs, setPref] = usePrefs()
  const { user, cloud, signOut } = useAuth()
  const { name } = useProfile()
  const servers = useMcpServers()

  const email = user?.email || ''

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(name || '')
  const [mcpName, setMcpName] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)

  const doLogout = async () => {
    haptic('warning')
    await signOut()
    setConfirmLogout(false)
    navigate('/login')
  }

  const saveDisplayName = async () => {
    if (nameDraft.trim()) await saveName(nameDraft.trim())
    setEditingName(false)
  }

  const onAddMcp = (e) => {
    e.preventDefault()
    if (!mcpUrl.trim()) return
    addServer({ name: mcpName, url: mcpUrl })
    setMcpName('')
    setMcpUrl('')
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

        {/* Account */}
        <div className="card mb-2 flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-body text-text-primary">
              {name || 'No name set'}
            </div>
            <div className="truncate text-body-sm text-text-tertiary">{email}</div>
          </div>
          <span className="ml-2 shrink-0 rounded-pill border border-border px-3 py-1 text-body-sm text-text-secondary">
            Account
          </span>
        </div>

        {/* Display name editor */}
        {editingName ? (
          <div className="card mb-4 flex items-center gap-2 p-3">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Display name"
              className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <button onClick={saveDisplayName} className="btn-primary h-9 px-4 text-body-sm">
              Save
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <Row
              icon={User}
              label="Display name"
              sub={name || 'Tap to set'}
              onClick={() => {
                setNameDraft(name || '')
                setEditingName(true)
              }}
            />
          </div>
        )}

        {/* Capabilities */}
        <SectionTitle>Capabilities</SectionTitle>
        <div className="space-y-2">
          <Row icon={SlidersHorizontal} label="Capabilities" sub="Search, code, memory enabled" />
          <Row icon={Shield} label="Permissions" sub="Manage tool access" />
          <Row icon={Brain} label="Memory" sub="Manage what NRVS remembers" onClick={() => navigate('/memory')} />
          <Row icon={KeyRound} label="Secrets" sub="API keys & tokens (synced, private)" onClick={() => navigate('/secrets')} />
          <Row icon={Code2} label="Developer API" sub="Use NRVS outside this app" onClick={() => navigate('/api-keys')} />
        </div>

        {/* MCP servers (part of Capabilities) */}
        <div className="mt-3 flex items-center gap-2 px-1 text-body-sm font-medium text-text-secondary">
          <Server size={15} /> MCP Servers
        </div>
        <div className="card mt-2 p-3">
          <p className="mb-3 text-body-sm text-text-tertiary">
            Connect Model Context Protocol servers to extend NRVS with external
            tools and data sources.
          </p>
          <form onSubmit={onAddMcp} className="mb-3 space-y-2">
            <input
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
              placeholder="Server name (e.g. GitHub)"
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                value={mcpUrl}
                onChange={(e) => setMcpUrl(e.target.value)}
                placeholder="https://server-url/sse"
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!mcpUrl.trim()}
                className="btn-primary h-9 px-4 text-body-sm disabled:opacity-40"
              >
                <Plus size={15} /> Add
              </button>
            </div>
          </form>

          {servers.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-body-sm text-text-tertiary">
              <Server size={15} /> No MCP servers connected yet.
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <Server size={16} className="shrink-0 text-text-secondary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-sm text-text-primary">
                      {s.name}
                    </div>
                    <div className="truncate text-caption text-text-tertiary">
                      {s.url}
                    </div>
                  </div>
                  <Toggle
                    checked={s.enabled}
                    onChange={() => toggleServer(s.id)}
                    label="Enable server"
                  />
                  <button
                    onClick={() => removeServer(s.id)}
                    className="shrink-0 rounded-sm p-1 text-text-tertiary hover:text-danger"
                    aria-label="Remove server"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Font */}
        <SectionTitle>Font</SectionTitle>
        <div className="card p-2">
          {FONT_OPTIONS.map((f) => {
            const active = prefs.fontId === f.id
            return (
              <button
                key={f.id}
                onClick={() => setPref('fontId', f.id)}
                className={`flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-surface2' : 'hover:bg-border'
                }`}
              >
                <span
                  className="text-body text-text-primary"
                  style={{ fontFamily: f.stack }}
                >
                  {f.name}
                </span>
                {active && <Check size={16} className="text-accent-blue" />}
              </button>
            )
          })}
        </div>

        {/* Preferences */}
        <SectionTitle>Preferences</SectionTitle>
        <div className="space-y-2">
          {/* Color mode segmented control */}
          <div className="card flex items-center gap-3 px-4 py-3">
            <Sun size={18} strokeWidth={1.75} className="text-text-secondary" />
            <span className="flex-1 text-body text-text-primary">Color mode</span>
            <div className="flex items-center rounded-pill border border-border bg-surface2 p-0.5">
              {['System', 'Light', 'Dark'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    haptic('select')
                    setPref('colorMode', m)
                  }}
                  className={`rounded-pill px-3 py-1 text-caption transition-colors ${
                    prefs.colorMode === m
                      ? 'bg-border text-text-primary'
                      : 'text-text-tertiary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Row icon={Mic} label="Voice" sub="Speech-to-text & read aloud" />
          <Row
            icon={Smartphone}
            label="Haptic feedback"
            sub="Vibrate on actions"
            right={
              <Toggle
                checked={prefs.haptic}
                onChange={(v) => {
                  setPref('haptic', v)
                  if (v) hapticTest() // let them feel it immediately
                }}
                label="Haptic feedback"
              />
            }
            onClick={() => {
              const next = !prefs.haptic
              setPref('haptic', next)
              if (next) hapticTest()
            }}
          />
          <Row
            icon={LinkIcon}
            label="Shared links"
            sub="Manage publicly shared chats"
            onClick={() => navigate('/shared-links')}
          />
        </div>

        {/* Logout */}
        <div className="mt-6">
          <Row
            icon={LogOut}
            label="Log out"
            danger
            right={<span />}
            onClick={() => setConfirmLogout(true)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You’ll need to sign in again to access your NRVS on this device."
        confirmLabel="Log out"
        danger
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </Layout>
  )
}
