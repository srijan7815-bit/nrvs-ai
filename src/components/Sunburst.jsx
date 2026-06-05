/**
 * Sunburst / asterisk brand mark in Accent Orange (#FF8A3D).
 * Recreated as an inline SVG so it renders without external assets.
 */
export default function Sunburst({ size = 40, className = '' }) {
  const rays = 12
  const cx = 50
  const cy = 50
  const inner = 6
  const outer = 46

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <g stroke="#FF8A3D" strokeWidth="6" strokeLinecap="round">
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / rays
          const x1 = cx + Math.cos(angle) * inner
          const y1 = cy + Math.sin(angle) * inner
          const x2 = cx + Math.cos(angle) * outer
          const y2 = cy + Math.sin(angle) * outer
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
      </g>
      <circle cx={cx} cy={cy} r="7" fill="#FF8A3D" />
    </svg>
  )
}
