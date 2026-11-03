import { AbsoluteFill, Easing, Freeze, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion"

// A camera keyframe: look at (x, y) on the 1920x1080 game table, zoomed by z.
// `snap` reaches it fast, like a whip zoom; otherwise the move is a smooth glide.
export interface Shot {
  frame: number
  x: number
  y: number
  z: number
  snap?: boolean
}

const DISSOLVE = 10

const glide = Easing.bezier(0.45, 0, 0.2, 1)
const whip = Easing.bezier(0.7, 0, 0.1, 1)

function cameraAt(frame: number, keys: Shot[]): { x: number; y: number; z: number; speed: number } {
  if (frame <= keys[0].frame) return { ...keys[0], speed: 0 }
  const next = keys.findIndex((key) => key.frame > frame)
  if (next === -1) return { ...keys[keys.length - 1], speed: 0 }

  const from = keys[next - 1]
  const to = keys[next]
  const linear = (frame - from.frame) / (to.frame - from.frame)
  const ease = to.snap ? whip : glide
  const progress = ease(linear)
  const speed = Math.abs(ease(Math.min(1, linear + 0.05)) - progress) * 20
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
    speed: to.snap ? speed * Math.abs(to.z - from.z) : 0,
  }
}

// A 4K gameplay clip under a virtual camera, so the edit can push in, pan and
// whip-zoom over real play without ever showing the edge of the frame.
// `pulses` are frames where the picture kicks in a little, to hit the beat.
// `smooth` are frames where the game's UI changes instantly (a panel popping in,
// fields re-centring); the old picture dissolves into the new one there instead.
export const Footage: React.FC<{ clip: string; from?: number; camera: Shot[]; rate?: number; dim?: number; pulses?: number[]; smooth?: number[] }> = ({ clip, from = 0, camera, rate = 1, dim = 0, pulses = [], smooth = [] }) => {
  const frame = useCurrentFrame()
  const view = cameraAt(frame, camera)
  const kick = pulses.reduce((total, pulse) => (frame >= pulse ? total + 0.045 * Math.exp(-(frame - pulse) / 5) : total), 0)
  const { x, y, speed } = view
  const z = view.z * (1 + kick)
  const halfW = 960 / z
  const halfH = 540 / z
  const lookX = Math.min(1920 - halfW, Math.max(halfW, x))
  const lookY = Math.min(1080 - halfH, Math.max(halfH, y))

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${960 - lookX * z}px, ${540 - lookY * z}px) scale(${z})`,
          filter: speed > 0.05 ? `blur(${Math.min(5, speed * 2.5)}px)` : undefined,
        }}
      >
        <OffthreadVideo src={staticFile(`footage/${clip}.mp4`)} trimBefore={from} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
        {smooth.map((jump) => {
          const fade = interpolate(frame, [jump - 1, jump + DISSOLVE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          if (frame < jump - 1 || fade <= 0) return null
          return (
            <AbsoluteFill key={jump} style={{ opacity: fade }}>
              <Freeze frame={jump - 2}>
                <OffthreadVideo src={staticFile(`footage/${clip}.mp4`)} trimBefore={from} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
              </Freeze>
            </AbsoluteFill>
          )
        })}
      </AbsoluteFill>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(20, 10, 4, ${dim})` }} />}
    </AbsoluteFill>
  )
}
