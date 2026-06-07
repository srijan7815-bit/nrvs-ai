import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateMission, createFlow } from './flows'
import { haptic } from './haptics'

/**
 * Launches Flow State: given an objective, generates a mission-control workspace
 * and navigates to it. Returns { launch, launching, error, overlay }.
 */
export function useFlowLauncher() {
  const navigate = useNavigate()
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState('')

  const launch = useCallback(
    async (objective, model) => {
      if (!objective?.trim()) return
      setError('')
      setLaunching(true)
      haptic('medium')
      try {
        const mission = await generateMission(objective.trim(), model)
        // Guard: don't create a broken/empty mission (e.g. generation timed out).
        const total =
          (mission?.tasks?.length || 0) +
          (mission?.roadmap?.length || 0) +
          (mission?.timeline?.length || 0)
        if (!mission || total === 0) {
          throw new Error(
            'NRVS couldn’t finish planning that objective in time. Please try again — rephrasing more specifically can help.'
          )
        }
        const id = await createFlow(objective.trim(), { ...mission, status: 'review' })
        navigate(`/flow/${id}`)
      } catch (e) {
        setError(e.message || 'Could not start Flow State.')
      } finally {
        setLaunching(false)
      }
    },
    [navigate]
  )

  const overlay =
    launching || error ? (
      <FlowOverlay error={error} onDismiss={() => setError('')} />
    ) : null
  return { launch, launching, error, overlay }
}

function FlowOverlay({ error, onDismiss }) {
  if (error) {
    return (
      <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-4 bg-bg/95 px-6 text-center backdrop-blur-sm">
        <div className="max-w-sm">
          <p className="text-heading-md font-semibold text-text-primary">
            Flow State hiccup
          </p>
          <p className="mt-2 text-body-sm text-text-secondary">{error}</p>
          <button
            onClick={onDismiss}
            className="btn-primary mx-auto mt-5 h-10 px-6 text-body-sm"
          >
            OK
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-5 bg-bg/95 px-6 text-center backdrop-blur-sm">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent-orange/20" />
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-orange/15">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF8A3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        </span>
      </div>
      <div>
        <p className="shimmer text-heading-md">Entering Flow State…</p>
        <p className="mt-1 text-body-sm text-text-tertiary">
          NRVS is building your mission control — roadmap, tasks, research,
          timeline & more.
        </p>
      </div>
    </div>
  )
}
