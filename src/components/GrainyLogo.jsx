import { useId } from 'react'

/**
 * "NRVS" wordmark with a grainy / sprayed texture, matching the reference image.
 * Bold condensed sans-serif text + an SVG turbulence grain filter, theme-aware
 * (renders in currentColor — white on the dark theme).
 */
export default function GrainyLogo({ className = '', height = 96 }) {
  const uid = useId().replace(/:/g, '')
  const grain = `grain-${uid}`
  const fade = `fade-${uid}`

  return (
    <svg
      viewBox="0 0 600 160"
      height={height}
      role="img"
      aria-label="NRVS"
      className={className}
      style={{ maxWidth: '100%' }}
    >
      <defs>
        {/* Grain: displace + roughen the fill, then knock out speckles for a sprayed look */}
        <filter id={grain} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          {/* speckle mask: use noise to vary opacity, giving the dusty texture */}
          <feComponentTransfer in="noise" result="speckle">
            <feFuncA type="linear" slope="1.1" intercept="-0.15" />
          </feComponentTransfer>
          <feComposite
            in="displaced"
            in2="speckle"
            operator="out"
            result="textured"
          />
          {/* keep most of the solid letter, blend the texture on top */}
          <feMerge>
            <feMergeNode in="displaced" />
            <feMergeNode in="textured" />
          </feMerge>
        </filter>

        {/* subtle vertical fade at edges, like the reference */}
        <radialGradient id={fade} cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.82" />
        </radialGradient>
      </defs>

      <g filter={`url(#${grain})`}>
        <text
          x="50%"
          y="52%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="currentColor"
          style={{
            fontFamily:
              '"Archivo Black", "Arial Narrow", "Helvetica Neue", Impact, sans-serif',
            fontWeight: 900,
            fontSize: '150px',
            letterSpacing: '-2px',
          }}
        >
          NRVS
        </text>
      </g>
    </svg>
  )
}
