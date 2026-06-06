import { AnimatePresence, motion } from 'framer-motion'

/**
 * Themed confirmation modal — replaces the browser's native confirm().
 * Props: open, title, message, confirmLabel, danger, onConfirm, onCancel.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-2xl"
          >
            <h2 className="text-heading-md font-semibold text-text-primary">
              {title}
            </h2>
            {message && (
              <p className="mt-2 text-body text-text-secondary">{message}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="btn-icon h-10 px-5 text-body-sm"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`h-10 rounded-pill px-5 text-body-sm font-medium transition-opacity hover:opacity-90 ${
                  danger ? 'bg-danger text-white' : 'bg-white text-black'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
