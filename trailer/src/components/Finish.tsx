import { AbsoluteFill, useCurrentFrame } from "remotion"

// The final look over every shot: living film grain, a warm grade and a soft vignette.
export const Finish: React.FC = () => {
  const frame = useCurrentFrame()
  // A new grain pattern every third frame reads as film, not noise.
  const seed = Math.floor(frame / 3) % 97

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(20, 10, 4, .55) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255, 190, 110, .05), rgba(120, 50, 10, .07))", mixBlendMode: "soft-light" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06, mixBlendMode: "overlay" }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  )
}
