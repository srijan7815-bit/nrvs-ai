/**
 * NRVS serif wordmark — high-contrast serif (Playfair Display) to match the logo.
 * Theme-aware (inherits currentColor). Letter-spaced like the uploaded mark.
 */
export default function Wordmark({ className = '', style }) {
  return (
    <span
      className={`select-none leading-none ${className}`}
      style={{
        fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
        fontWeight: 600,
        letterSpacing: '0.06em',
        fontFeatureSettings: '"liga" 1',
        ...style,
      }}
      aria-label="NRVS"
    >
      NRVS
    </span>
  )
}
