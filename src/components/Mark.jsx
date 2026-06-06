/**
 * NRVS icon mark — a serif "N" monogram used as the assistant avatar / app icon,
 * replacing the old orange sunburst. Theme-aware (white on dark).
 */
export default function Mark({ size = 24, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      style={{
        fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
        fontWeight: 600,
        fontSize: Math.round(size * 0.82),
        width: size,
        height: size,
      }}
      aria-label="NRVS"
    >
      N
    </span>
  )
}
