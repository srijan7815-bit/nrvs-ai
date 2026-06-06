import { useCallback, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

/**
 * Hook returning [confirm(opts) -> Promise<bool>, <ConfirmUI/>].
 * Render {ui} once in the component; call await confirm({...}) to ask.
 */
export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const close = (val) => {
    state?.resolve?.(val)
    setState(null)
  }

  const ui = (
    <ConfirmDialog
      open={!!state}
      title={state?.title || 'Are you sure?'}
      message={state?.message}
      confirmLabel={state?.confirmLabel || 'Delete'}
      cancelLabel={state?.cancelLabel || 'Cancel'}
      danger={state?.danger ?? true}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  )

  return [confirm, ui]
}
