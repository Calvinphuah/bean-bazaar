import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"
import { Backdrop } from "../components/Backdrop"
import { Card } from "../components/Card"
import { Stamp } from "../components/Stamp"
import { COLORS, type BeanKey } from "../theme"
import { beats, cold } from "../timeline"

// A card that drops onto the table and lands on frame 8 with a little bounce.
const LAND = 8

const Slap: React.FC<{ bean: BeanKey; x: number; y: number; turn: number; width?: number }> = ({ bean, x, y, turn, width = 330 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fall = interpolate(frame, [0, LAND], [0, 1], { extrapolateRight: "clamp", easing: (t) => t * t })
  const settle = spring({ frame: frame - LAND, fps, config: { damping: 9, stiffness: 400 } })
  const scale = frame < LAND ? interpolate(fall, [0, 1], [2.2, 1]) : 1 + (1 - settle) * 0.04
  const shadow = interpolate(fall, [0, 1], [70, 18])
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${turn + (1 - fall) * 18}deg) scale(${scale})`, opacity: interpolate(frame, [0, 2], [0, 1]) }}>
      <Card bean={bean} width={width} style={{ boxShadow: `0 ${shadow}px ${shadow * 1.4}px -10px rgba(0,0,0,.8)` }} />
    </div>
  )
}

// Cold open: silence, then three cards slap onto the table, one per beat.
const SLAPS: { bean: BeanKey; beat: number; x: number; y: number; turn: number }[] = [
  { bean: "blue", beat: 1, x: 760, y: 560, turn: -9 },
  { bean: "chili", beat: 2, x: 1160, y: 520, turn: 7 },
  { bean: "stink", beat: 3, x: 960, y: 580, turn: -2 },
]

export const SLAP_FRAMES = SLAPS.map((slap) => cold(slap.beat))

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" }) }}>
        <Backdrop glow="rgba(246, 170, 80, .22)" />
      </AbsoluteFill>
      {SLAPS.map((slap) => (
        <Sequence key={slap.bean} from={cold(slap.beat) - LAND}>
          <Slap {...slap} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

// The cast, two beats each: each card glides in with its name and one line about it.
export const CAST: { bean: BeanKey; note: string }[] = [
  { bean: "blue", note: "Plays the blues" },
  { bean: "chili", note: "Always cold" },
  { bean: "stink", note: "Means well" },
  { bean: "soy", note: "Pours it on" },
  { bean: "red", note: "Stage fright" },
  { bean: "wax", note: "Surf's up" },
  { bean: "coffee", note: "Wide awake" },
]
export const CAST_BEATS = 2

const NAMES: Partial<Record<BeanKey, string>> = { black_eyed: "Black-eyed" }

const Portrait: React.FC<{ bean: BeanKey; note: string; side: number }> = ({ bean, note, side }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 120 } })
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 960 - side * 330 + side * -700 * (1 - enter),
          top: 545,
          transform: `translate(-50%, -50%) rotate(${side * (-5 + (1 - enter) * -14)}deg) scale(${1 + frame * 0.0012})`,
        }}
      >
        <Card bean={bean} width={440} />
      </div>
      <Sequence from={6} layout="none">
        <Stamp text={NAMES[bean] ?? bean[0].toUpperCase() + bean.slice(1)} size={150} x={960 + side * 390} y={470} tilt={side * 2 - 2} />
      </Sequence>
      <Sequence from={16} layout="none">
        <Stamp text={note} look="tag" size={62} x={960 + side * 390} y={620} tilt={side * -2} />
      </Sequence>
    </AbsoluteFill>
  )
}

const FAN: BeanKey[] = ["coffee", "green", "black_eyed", "blue", "chili", "stink", "soy", "red", "wax"]

// The whole cast fanned out like a hand, under the one word that sums them up.
const Fan: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + frame * 0.002})`, transformOrigin: "50% 70%" }}>
      {FAN.map((bean, index) => {
        const spread = spring({ frame: frame - index * 1.2, fps, config: { damping: 13, stiffness: 180 } })
        const angle = (index - (FAN.length - 1) / 2) * 9 * spread
        return (
          <div key={bean} style={{ position: "absolute", left: 960, top: 1420 - spread * 360, transformOrigin: "50% 160%", transform: `translate(-50%, -50%) rotate(${angle}deg)` }}>
            <Card bean={bean} width={300} />
          </div>
        )
      })}
      <Sequence from={4} layout="none">
        <Stamp text="ADORABLE." size={200} y={330} />
      </Sequence>
    </AbsoluteFill>
  )
}

export const MeetTheBeans: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    {CAST.map((member, index) => (
      <Sequence key={member.bean} from={beats(index * CAST_BEATS)} durationInFrames={beats((index + 1) * CAST_BEATS) - beats(index * CAST_BEATS)}>
        <Portrait {...member} side={index % 2 ? -1 : 1} />
      </Sequence>
    ))}
    <Sequence from={beats(CAST.length * CAST_BEATS)}>
      <Fan />
    </Sequence>
    <AbsoluteFill style={{ boxShadow: `inset 0 0 220px ${COLORS.table}`, pointerEvents: "none" }} />
  </AbsoluteFill>
)

// The bookend: the cast slaps down onto the table one per beat, piling up,
// the Golden bean landing last on top.
const PILE: { bean: BeanKey; x: number; y: number; turn: number }[] = [
  { bean: "blue", x: 620, y: 520, turn: -14 },
  { bean: "chili", x: 1300, y: 500, turn: 11 },
  { bean: "stink", x: 820, y: 640, turn: 6 },
  { bean: "soy", x: 1120, y: 620, turn: -8 },
  { bean: "red", x: 520, y: 700, turn: 9 },
  { bean: "coffee", x: 1420, y: 700, turn: -6 },
  { bean: "wax", x: 960, y: 480, turn: -3 },
  { bean: "golden", x: 960, y: 590, turn: 2 },
]

export const PILE_BEATS = PILE.map((_, index) => index)

export const CastPile: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    {PILE.map((card, index) => (
      <Sequence key={card.bean} from={beats(index) - LAND}>
        <Slap {...card} width={card.bean === "golden" ? 380 : 300} />
      </Sequence>
    ))}
  </AbsoluteFill>
)
