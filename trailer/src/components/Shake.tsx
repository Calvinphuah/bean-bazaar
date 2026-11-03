import { AbsoluteFill, useCurrentFrame } from "remotion"

export interface Impact {
  frame: number
  strength: number
}

const SETTLE = 18

// Rocks the whole picture on each impact: a smooth sway that dies out, not a
// random jitter (per-frame jitter reads as flicker).
export const Shake: React.FC<{ impacts: Impact[]; children: React.ReactNode }> = ({ impacts, children }) => {
  const frame = useCurrentFrame()
  let x = 0
  let y = 0
  for (const impact of impacts) {
    const age = frame - impact.frame
    if (age < 0 || age >= SETTLE) continue
    const amount = impact.strength * 0.6 * (1 - age / SETTLE) ** 2
    x += Math.sin(age * 1.3) * amount
    y += Math.cos(age * 1.7) * amount * 0.6
  }
  // Always scaled up a touch, so a shake never shows an edge and never pops the framing.
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(1.03)` }}>{children}</AbsoluteFill>
}
