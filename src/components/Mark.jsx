import markUrl from '../assets/nrvs-mark.png'

/**
 * NRVS icon mark — uses the uploaded NRVS wordmark image (white, transparent bg).
 * Used as the assistant avatar / small brand mark.
 */
export default function Mark({ size = 24, className = '' }) {
  return (
    <img
      src={markUrl}
      alt="NRVS"
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{ height: size * 0.62, width: 'auto', maxWidth: size * 1.6 }}
    />
  )
}
