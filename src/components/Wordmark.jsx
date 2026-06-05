/**
 * NRVS serif wordmark (recreated to match the uploaded logo).
 * Uses a serif font with a slightly condensed, letter-spaced look and a flared "R".
 * Theme-aware: inherits currentColor (white on the dark theme).
 */
export default function Wordmark({ className = '', style }) {
  return (
    <span
      className={`select-none font-serif font-semibold leading-none tracking-[0.04em] ${className}`}
      style={{
        fontFamily:
          '"Playfair Display", Georgia, "Times New Roman", serif',
        ...style,
      }}
      aria-label="NRVS"
    >
      NRVS
    </span>
  )
}
