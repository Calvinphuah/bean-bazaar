import { AbsoluteFill, Easing, Img, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { Card } from "../components/Card"
import { Sparkles } from "../components/Particles"
import { Stamp } from "../components/Stamp"
import { BODY, COLORS, DISPLAY, type BeanKey } from "../theme"

// One bot steps up: portrait pops in with a bounce, name stamped beside it,
// and its catchphrase in a speech bubble, exactly as it talks in the game.
export const BotCallout: React.FC<{ bot: string; line: string; side: number }> = ({ bot, line, side }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 220 } })
  const bubble = spring({ frame: frame - 5, fps, config: { damping: 11, stiffness: 260 } })
  const x = 960 + side * 360
  const nod = Math.sin(frame / 5) * 3 * Math.max(0, 1 - frame / 40)
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: 560, transform: `translate(-50%, -50%) scale(${pop}) rotate(${nod}deg)` }}>
        <div style={{ width: 380, height: 380, borderRadius: "50%", background: COLORS.panel, border: `10px solid ${COLORS.ink}`, boxShadow: `0 14px 0 ${COLORS.ink}, 0 40px 70px rgba(0,0,0,.55)`, overflow: "hidden" }}>
          <Img src={staticFile(`art/${bot.toLowerCase()}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      <Sequence from={4} layout="none">
        <Stamp text={bot} size={130} x={x} y={830} tilt={side * 3} />
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 960 - side * 260,
          top: 400,
          transform: `translate(-50%, -50%) scale(${bubble}) rotate(${side * -3}deg)`,
          transformOrigin: side > 0 ? "100% 100%" : "0% 100%",
          padding: "34px 56px",
          background: "#fff",
          border: `8px solid ${COLORS.ink}`,
          borderRadius: 60,
          boxShadow: `0 10px 0 ${COLORS.ink}`,
          fontFamily: BODY,
          fontWeight: 800,
          fontSize: 76,
          color: COLORS.ink,
          whiteSpace: "nowrap",
        }}
      >
        “{line}”
      </div>
    </AbsoluteFill>
  )
}

// The Golden bean, revealed: a card back spins over in a dark royal room with
// turning god-rays, flips to the Golden face and catches the light.
export const GoldenReveal: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const flip = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 90 } })
  const turn = interpolate(flip, [0, 1], [180, 0])
  const showingBack = turn > 90
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 120 } })
  const sweep = interpolate(frame, [26, 52], [-60, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const bob = Math.sin(frame / 18) * 8
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #5a2c86 0%, ${COLORS.royal} 45%, #12061e 100%)`, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: "repeating-conic-gradient(from 0deg at 50% 46%, rgba(255, 214, 110, .20) 0deg 7deg, transparent 7deg 22deg)",
          transform: `rotate(${frame * 0.35}deg) scale(1.6)`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
          maskImage: "radial-gradient(circle at 50% 46%, #000 0%, transparent 62%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 46%, rgba(255, 210, 90, .45), transparent 35%)", opacity: flip }} />
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 500 + bob,
          transform: `translate(-50%, -50%) perspective(1800px) rotateY(${turn}deg) scale(${0.6 + rise * 0.4})`,
        }}
      >
        <div style={{ position: "relative", transform: showingBack ? "rotateY(180deg)" : undefined }}>
          <Card bean="golden" back={showingBack} width={430} style={{ boxShadow: `0 0 ${80 * flip}px ${20 * flip}px rgba(255, 200, 80, .55), 0 40px 60px -10px rgba(0,0,0,.8)` }} />
          {!showingBack && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 30,
                background: `linear-gradient(105deg, transparent ${sweep - 18}%, rgba(255,255,255,.75) ${sweep}%, transparent ${sweep + 18}%)`,
                mixBlendMode: "overlay",
              }}
            />
          )}
        </div>
      </div>
      <Sparkles x={960} y={500} spread={420} count={30} seed="golden" />
    </AbsoluteFill>
  )
}

// The end card: a market stall. The awning drops in, the string lights blink on,
// and the Bean Bazaar sign falls into its ropes from two fixed hooks, bounces,
// swings and settles, while the call to action pops in underneath.
const HOOK_Y = 168
const HOOK_SPREAD = 430
const STRIPE = 120
const BULBS = 15

const Awning: React.FC<{ frame: number }> = ({ frame }) => {
  const slide = interpolate(frame, [0, 10], [-260, 0], { extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 })
  return (
    <div style={{ position: "absolute", left: 0, top: slide, width: 1920, height: 200 }}>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 46, background: `linear-gradient(180deg, #7a4a26, ${COLORS.woodDark})`, borderBottom: `6px solid ${COLORS.ink}` }} />
      <svg width={1920} height={200} style={{ position: "absolute", top: 40 }}>
        {Array.from({ length: 1920 / STRIPE + 1 }, (_, index) => (
          <path
            key={index}
            d={`M${index * STRIPE} 0 h${STRIPE} v82 a${STRIPE / 2} ${STRIPE / 2.6} 0 0 1 -${STRIPE} 0 z`}
            fill={index % 2 ? COLORS.panel : COLORS.accent}
            stroke={COLORS.ink}
            strokeWidth={6}
          />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 46, height: 30, background: "linear-gradient(180deg, rgba(0,0,0,.35), transparent)" }} />
    </div>
  )
}

const StringLights: React.FC<{ frame: number }> = ({ frame }) => {
  const sag = (x: number) => 205 + Math.sin((x / 1920) * Math.PI) * 70
  const path = Array.from({ length: 49 }, (_, index) => `${index ? "L" : "M"}${index * 40} ${sag(index * 40)}`).join(" ")
  return (
    <AbsoluteFill style={{ opacity: interpolate(frame, [6, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
      <svg width={1920} height={400} style={{ position: "absolute", top: 0 }}>
        <path d={path} fill="none" stroke="#2b1d14" strokeWidth={4} />
      </svg>
      {Array.from({ length: BULBS }, (_, index) => {
        const x = 64 + index * ((1920 - 128) / (BULBS - 1))
        const on = frame > 10 + index * 1.5
        const flicker = 0.85 + Math.sin(frame / 7 + index * 1.7) * 0.15
        return (
          <div key={index} style={{ position: "absolute", left: x, top: sag(x) + 8, transform: "translate(-50%, 0)" }}>
            <div style={{ width: 22, height: 30, borderRadius: "50% 50% 46% 46%", background: on ? "#ffe39a" : "#6b5434", boxShadow: on ? `0 0 ${26 * flicker}px ${10 * flicker}px rgba(255, 196, 90, .65)` : "none", border: `3px solid ${COLORS.ink}` }} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

const Rope: React.FC<{ from: [number, number]; to: [number, number] }> = ({ from, to }) => (
  <>
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={COLORS.ink} strokeWidth={16} strokeLinecap="round" />
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#c9a46a" strokeWidth={9} strokeLinecap="round" />
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#8a6a3a" strokeWidth={9} strokeDasharray="6 10" />
    <circle cx={from[0]} cy={from[1]} r={13} fill="#d9a441" stroke={COLORS.ink} strokeWidth={5} />
  </>
)

// Cards rain down first, behind everything, before the sign drops in.
const TUMBLERS: BeanKey[] = ["blue", "chili", "stink", "soy", "golden", "red", "coffee", "green", "wax", "black_eyed"]
const SIGN_DELAY = 24

const PEEK: { bean: BeanKey; x: number; turn: number }[] = [
  { bean: "chili", x: 150, turn: -18 },
  { bean: "blue", x: 330, turn: -6 },
  { bean: "golden", x: 1590, turn: 6 },
  { bean: "stink", x: 1770, turn: 18 },
]

export const EndCard: React.FC<{ url: string }> = ({ url }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // The sign drops past its rest point, the ropes snap taut, it bounces and swings.
  const fall = spring({ frame: frame - SIGN_DELAY, fps, config: { damping: 8, stiffness: 140, mass: 1 } })
  const top = interpolate(fall, [0, 1], [-420, 370])
  const settled = frame - SIGN_DELAY - 10
  const swing = settled > 0 ? Math.sin(settled / 9) * 5 * Math.exp(-settled / 45) : 0
  const turn = (swing * Math.PI) / 180
  const attach = (side: number): [number, number] => [960 + Math.cos(turn) * side * HOOK_SPREAD, top + Math.sin(turn) * side * HOOK_SPREAD]
  const call = spring({ frame: frame - 34, fps, config: { damping: 12, stiffness: 200 } })
  const fadeOut = interpolate(frame, [300, 350], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {TUMBLERS.map((bean, index) => {
        const t = Math.max(0, frame - index * 2) / 60
        const x = 140 + random(`tumble-x-${index}`) * 1640
        const y = -180 + t * t * 1300 + t * 700
        const spin = (random(`tumble-r-${index}`) - 0.5) * 420 * t
        if (y > 1400) return null
        return (
          <div key={bean} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${spin}deg)`, filter: "blur(1px)" }}>
            <Card bean={bean} width={170 + random(`tumble-s-${index}`) * 60} />
          </div>
        )
      })}
      {PEEK.map((card, index) => {
        const rise = spring({ frame: frame - 44 - index * 3, fps, config: { damping: 13, stiffness: 160 } })
        return (
          <div key={card.bean} style={{ position: "absolute", left: card.x, top: 1080 + 150 - rise * 260, transform: `translate(-50%, 0) rotate(${card.turn}deg)` }}>
            <Card bean={card.bean} width={230} />
          </div>
        )
      })}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Rope from={[960 - HOOK_SPREAD, HOOK_Y]} to={attach(-1)} />
        <Rope from={[960 + HOOK_SPREAD, HOOK_Y]} to={attach(1)} />
      </svg>
      <div style={{ position: "absolute", left: 960, top, transformOrigin: "50% 0%", transform: `translateX(-50%) rotate(${swing}deg)` }}>
        <div
          style={{
            position: "relative",
            width: 1220,
            padding: "46px 0 40px",
            borderRadius: 34,
            textAlign: "center",
            background: `linear-gradient(180deg, transparent 49.6%, rgba(0,0,0,.28) 49.6% 50.4%, transparent 50.4%), repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 2px, transparent 2px 26px), linear-gradient(180deg, #c08350, #8a5228 60%, ${COLORS.woodDark})`,
            border: `12px solid ${COLORS.ink}`,
            boxShadow: `inset 0 0 0 8px #d9a441, inset 0 0 0 14px ${COLORS.ink}, 0 18px 0 ${COLORS.ink}, 0 60px 100px rgba(0,0,0,.6)`,
          }}
        >
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => (
            <div key={`${x}${y}`} style={{ position: "absolute", left: x < 0 ? 34 : undefined, right: x > 0 ? 34 : undefined, top: y < 0 ? 30 : undefined, bottom: y > 0 ? 30 : undefined, width: 18, height: 18, borderRadius: "50%", background: "#d9a441", border: `4px solid ${COLORS.ink}` }} />
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34 }}>
            <Img src={staticFile("art/coin.webp")} style={{ width: 92, transform: "rotate(-12deg)" }} />
            <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 164, lineHeight: 1, whiteSpace: "nowrap", color: COLORS.gold, WebkitTextStroke: `20px ${COLORS.ink}`, paintOrder: "stroke fill", textShadow: `0 12px 0 ${COLORS.ink}` }}>
              Bean Bazaar
            </div>
            <Img src={staticFile("art/coin.webp")} style={{ width: 92, transform: "rotate(12deg)" }} />
          </div>
          <div style={{ marginTop: 18, fontFamily: BODY, fontWeight: 800, fontSize: 38, letterSpacing: 6, textTransform: "uppercase", color: COLORS.panel, textShadow: `0 3px 0 ${COLORS.ink}` }}>
            A bean-trading card game
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 960, top: 800, transform: `translate(-50%, -50%) scale(${call})`, textAlign: "center" }}>
        <div style={{ display: "inline-block", padding: "22px 60px", background: COLORS.gold, border: `8px solid ${COLORS.ink}`, borderRadius: 60, boxShadow: `0 10px 0 ${COLORS.ink}, 0 0 60px rgba(246, 201, 56, .35)`, fontFamily: BODY, fontWeight: 800, fontSize: 62, color: COLORS.ink }}>
          Play free in your browser
        </div>
        <div style={{ marginTop: 30, fontFamily: BODY, fontWeight: 800, fontSize: 46, color: COLORS.panel, letterSpacing: 1, textShadow: "0 3px 12px rgba(0,0,0,.7)" }}>{url}</div>
      </div>
      <StringLights frame={frame} />
      <Awning frame={frame} />
    </AbsoluteFill>
  )
}

// The race to the end: every player's coins climb, Mung leads, and "You" pip
// them at the line, matching the hero game's final scores.
const RACE = [
  { name: "You", art: null, final: 14, lead: 0.55 },
  { name: "Mung", art: "mung", final: 13, lead: 1 },
  { name: "Lima", art: "lima", final: 12, lead: 0.85 },
  { name: "Fava", art: "fava", final: 11, lead: 0.8 },
  { name: "Pinto", art: "pinto", final: 10, lead: 0.75 },
]

export const Leaderboard: React.FC<{ length: number }> = ({ length }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = Easing.inOut(Easing.cubic)(Math.min(1, frame / (length * 0.9)))
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 1240, display: "flex", flexDirection: "column", gap: 22 }}>
        {RACE.map((player, index) => {
          const enter = spring({ frame: frame - index * 3, fps, config: { damping: 14, stiffness: 200 } })
          // Others race ahead early; "You" surge late and finish on top.
          const curve = player.name === "You" ? progress ** 2.2 : Math.min(1, progress * (1 + (1 - player.lead) * 0.2)) ** 0.8
          const value = player.final * curve
          const coins = Math.round(value)
          const you = player.name === "You"
          return (
            <div key={player.name} style={{ display: "flex", alignItems: "center", gap: 24, transform: `translateX(${(1 - enter) * -400}px)`, opacity: enter }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", border: `6px solid ${COLORS.ink}`, background: you ? COLORS.gold : COLORS.panel, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {player.art ? <Img src={staticFile(`art/${player.art}.webp`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Img src={staticFile("art/coin.webp")} style={{ width: 64 }} />}
              </div>
              <div style={{ width: 170, fontFamily: DISPLAY, fontWeight: 900, fontSize: 52, color: you ? COLORS.gold : COLORS.panel, WebkitTextStroke: `8px ${COLORS.ink}`, paintOrder: "stroke fill" }}>{player.name}</div>
              <div style={{ flex: 1, height: 64, borderRadius: 32, background: "rgba(0,0,0,.35)", border: `5px solid ${COLORS.ink}`, overflow: "hidden" }}>
                <div style={{ width: `${(value / 14) * 100}%`, height: "100%", background: you ? `linear-gradient(90deg, ${COLORS.goldDark}, ${COLORS.gold})` : `linear-gradient(90deg, #8a7a66, ${COLORS.panelDark})`, boxShadow: you ? "0 0 30px rgba(246, 201, 56, .6)" : "none" }} />
              </div>
              <div style={{ width: 150, display: "flex", alignItems: "center", gap: 10, fontFamily: DISPLAY, fontWeight: 900, fontSize: 60, color: COLORS.gold, WebkitTextStroke: `9px ${COLORS.ink}`, paintOrder: "stroke fill" }}>
                <Img src={staticFile("art/coin.webp")} style={{ width: 50 }} />
                {coins}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
