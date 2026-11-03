import { AbsoluteFill, random, useCurrentFrame } from "remotion"
import { COLORS } from "../theme"

const MOTES = 38

// The dark market table behind title cards: slow lantern light drifting over
// wood planks, with dust motes floating up through it.
export const Backdrop: React.FC<{ tint?: string; glow?: string }> = ({ tint = COLORS.table, glow = "rgba(246, 170, 80, .30)" }) => {
  const frame = useCurrentFrame()
  const drift = frame / 60
  const lightX = 50 + Math.sin(drift * 0.35) * 14
  const lightY = 42 + Math.cos(drift * 0.27) * 8

  return (
    <AbsoluteFill style={{ background: tint, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: "repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 2px, transparent 2px 180px), repeating-linear-gradient(90deg, rgba(255,220,170,.025) 0 1px, transparent 1px 13px)",
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 55% at ${lightX}% ${lightY}%, ${glow}, transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 35% 30% at ${100 - lightX}% ${80 - lightY / 2}%, rgba(198, 40, 58, .10), transparent 70%)` }} />
      {Array.from({ length: MOTES }, (_, index) => {
        const speed = 0.25 + random(`mote-speed-${index}`) * 0.6
        const y = (1.1 - ((random(`mote-y-${index}`) + drift * speed * 0.06) % 1.2)) * 1080
        const x = random(`mote-x-${index}`) * 1920 + Math.sin(drift * speed + index) * 30
        const size = 2 + random(`mote-size-${index}`) * 5
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgba(255, 214, 150, .55)",
              filter: `blur(${size > 5 ? 2 : 0.6}px)`,
              opacity: 0.25 + random(`mote-o-${index}`) * 0.5,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}
