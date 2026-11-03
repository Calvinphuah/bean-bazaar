import { AbsoluteFill, Img, random, staticFile, useCurrentFrame } from "remotion"

// A fountain of spinning gold coins thrown up from (x, y), falling under gravity.
export const CoinBurst: React.FC<{ x: number; y: number; count?: number; power?: number; seed?: string; size?: number }> = ({ x, y, count = 28, power = 1, seed = "coins", size = 70 }) => {
  const frame = useCurrentFrame()
  const time = frame / 60
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, index) => {
        const delay = random(`${seed}-d-${index}`) * 0.12
        const t = time - delay
        if (t < 0) return null
        const angle = (-90 + (random(`${seed}-a-${index}`) - 0.5) * 110) * (Math.PI / 180)
        const speed = (900 + random(`${seed}-s-${index}`) * 900) * power
        const px = x + Math.cos(angle) * speed * t
        const py = y + Math.sin(angle) * speed * t + 0.5 * 2600 * t * t
        const spin = Math.cos(t * (10 + random(`${seed}-r-${index}`) * 14))
        const scale = 0.6 + random(`${seed}-z-${index}`) * 0.7
        if (py > 1300) return null
        return (
          <Img
            key={index}
            src={staticFile("art/coin.webp")}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: size * scale,
              transform: `translate(-50%, -50%) scaleX(${spin}) rotate(${t * 200 * (index % 2 ? 1 : -1)}deg)`,
              filter: "drop-shadow(0 6px 6px rgba(0,0,0,.45))",
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

// Four-point twinkles scattered around a centre, for anything golden.
export const Sparkles: React.FC<{ x: number; y: number; spread: number; count?: number; seed?: string }> = ({ x, y, spread, count = 22, seed = "sparkle" }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, index) => {
        const period = 40 + random(`${seed}-p-${index}`) * 50
        const phase = ((frame + random(`${seed}-o-${index}`) * period) % period) / period
        const glow = Math.sin(phase * Math.PI)
        const size = 14 + random(`${seed}-s-${index}`) * 30
        const angle = random(`${seed}-a-${index}`) * Math.PI * 2
        const distance = spread * (0.35 + random(`${seed}-d-${index}`) * 0.75)
        return (
          <svg
            key={index}
            viewBox="-10 -10 20 20"
            style={{
              position: "absolute",
              left: x + Math.cos(angle) * distance * 1.3,
              top: y + Math.sin(angle) * distance,
              width: size,
              height: size,
              transform: `translate(-50%, -50%) scale(${glow}) rotate(${frame * 2}deg)`,
              opacity: glow,
              filter: "drop-shadow(0 0 6px rgba(255, 220, 120, .9))",
            }}
          >
            <path d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2 Z" fill="#fff6c8" />
          </svg>
        )
      })}
    </AbsoluteFill>
  )
}

// A hit of light on a beat: a quick warm flash that falls off fast.
export const Flash: React.FC<{ strength?: number; color?: string; length?: number }> = ({ strength = 0.8, color = "#fff3d6", length = 10 }) => {
  const frame = useCurrentFrame()
  const fade = Math.max(0, 1 - frame / length)
  return <AbsoluteFill style={{ background: color, opacity: strength * fade * fade, pointerEvents: "none" }} />
}
