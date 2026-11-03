import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { COLORS, DISPLAY } from "../theme"

interface StampProps {
  text: string
  size?: number
  tilt?: number
  x?: number
  y?: number
  // "gold" is the game's lettering; "tag" is a cream market price tag with ink letters.
  look?: "gold" | "tag"
}

// A title that lands like a market stamp: letters drop in big, overshoot, settle
// with a wobble, and kick up a ring of dust as the last one hits.
export const Stamp: React.FC<StampProps> = ({ text, size = 190, tilt = -3, x = 960, y = 540, look = "gold" }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const letters = [...text]
  const landed = 5
  const dust = interpolate(frame - landed, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const gold = look === "gold"

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          width: "110%",
          height: size * 1.1,
          transform: `translate(-50%, -50%) scale(${0.7 + dust * 0.7})`,
          borderRadius: "50%",
          border: `${size * 0.05}px solid rgba(43, 29, 20, ${0.35 * (1 - dust)})`,
          opacity: dust > 0 ? 1 : 0,
        }}
      />
      <div
        style={{
          position: "relative",
          padding: gold ? 0 : `${size * 0.12}px ${size * 0.32}px ${size * 0.16}px`,
          background: gold ? "none" : COLORS.panel,
          border: gold ? "none" : `${size * 0.05}px solid ${COLORS.ink}`,
          borderRadius: size * 0.16,
          boxShadow: gold ? "none" : `0 ${size * 0.07}px 0 ${COLORS.ink}, 0 ${size * 0.25}px ${size * 0.4}px rgba(0,0,0,.45)`,
          transform: gold ? "none" : `scale(${interpolate(spring({ frame, fps, config: { damping: 12, stiffness: 300 } }), [0, 1], [1.8, 1])})`,
          opacity: gold ? 1 : interpolate(frame, [0, 2], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {letters.map((letter, index) => {
          // Every title lands as one solid word; letters arriving one by one at
          // double size overlapped each other and read as a glitch.
          const local = gold ? frame : 99
          const settle = spring({ frame: local, fps, config: { damping: 10, stiffness: 320, mass: 0.55 } })
          const rest = gold ? (random(`${text}-rest-${index}`) - 0.5) * 5 : 0
          return (
            <span
              key={index}
              style={{
                display: "inline-block",
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: size,
                lineHeight: 1,
                letterSpacing: size * 0.01,
                color: gold ? COLORS.gold : COLORS.ink,
                WebkitTextStroke: gold ? `${size * 0.075}px ${COLORS.ink}` : "none",
                paintOrder: "stroke fill",
                textShadow: gold ? `0 ${size * 0.05}px 0 ${COLORS.ink}, 0 ${size * 0.18}px ${size * 0.3}px rgba(0,0,0,.5)` : "none",
                opacity: interpolate(local, [0, 1.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                transform: `translateY(${(1 - settle) * -size * 0.2}px) scale(${interpolate(settle, [0, 1], [1.5, 1])}) rotate(${rest}deg)`,
                whiteSpace: "pre",
              }}
            >
              {letter}
            </span>
          )
        })}
      </div>
    </div>
  )
}
