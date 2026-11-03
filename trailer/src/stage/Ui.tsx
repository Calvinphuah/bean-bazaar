import { AbsoluteFill, Easing, Img, interpolate, staticFile } from "remotion"
import { Card } from "../components/Card"
import { BODY, COLORS, DISPLAY, type BeanKey } from "../theme"

// The game's own UI, redrawn at close-up size for staged gameplay: the same
// table, field slots, count badges, pill buttons, name plates and offer panel,
// so every move can land exactly on the beat and its caption.

export const CARD = 200
const CARD_H = (CARD * 88) / 63

// The game's wooden market table (style.css, body background).
export const Table: React.FC = () => (
  <AbsoluteFill
    style={{
      background: [
        "radial-gradient(ellipse at 50% 45%, rgba(255, 214, 150, .28), transparent 65%)",
        "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(30, 14, 4, .55))",
        "repeating-linear-gradient(90deg, rgba(60, 30, 10, .16) 0 4px, transparent 4px 360px)",
        "repeating-linear-gradient(90deg, rgba(255, 220, 170, .05) 0 2px, transparent 2px 46px)",
        "repeating-linear-gradient(0deg, rgba(90, 45, 15, .06) 0 6px, transparent 6px 22px)",
        "linear-gradient(#a8653a, #8c4f2b)",
      ].join(", "),
    }}
  />
)

export type Point = { x: number; y: number }

const bounce = Easing.bezier(0.34, 1.56, 0.64, 1)

// A pill button in the game's style; `pressed` (0..1) pushes it down.
export const Button: React.FC<{ label: string; gold?: boolean; size?: number; pressed?: number; style?: React.CSSProperties }> = ({ label, gold = false, size = 26, pressed = 0, style }) => (
  <div
    style={{
      display: "inline-block",
      padding: `${size * 0.36}px ${size * 0.8}px`,
      borderRadius: 999,
      border: `${size * 0.12}px solid ${COLORS.ink}`,
      background: gold ? COLORS.gold : COLORS.panel,
      boxShadow: `0 ${size * 0.12 * (1 - pressed)}px 0 ${COLORS.ink}`,
      transform: `translateY(${size * 0.1 * pressed}px)`,
      fontFamily: BODY,
      fontWeight: 800,
      fontSize: size,
      color: COLORS.ink,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {label}
  </div>
)

// The red count badge on a field's pile; `bump` (0..1) is its pop when it changes.
const Badge: React.FC<{ count: number; bump: number }> = ({ count, bump }) => (
  <div
    style={{
      position: "absolute",
      top: -20,
      right: -24,
      minWidth: 60,
      height: 60,
      padding: "0 12px",
      display: "grid",
      placeItems: "center",
      borderRadius: 999,
      background: COLORS.accent,
      border: `4px solid ${COLORS.ink}`,
      color: "#fff",
      fontFamily: BODY,
      fontWeight: 800,
      fontSize: 32,
      transform: `scale(${1 + Math.sin(bump * Math.PI) * 0.35})`,
      zIndex: 2,
    }}
  >
    {count}
  </div>
)

export interface FieldProps {
  at: Point
  bean: BeanKey | null
  count: number
  // The two lines under the pile, as the game prints them.
  info?: [string, string?]
  button?: { label: string; gold?: boolean; pressed?: number }
  // 0..1 badge pop, 0..1 soft gold glow (a fully grown field).
  bump?: number
  glow?: number
  // 0..1 highlight when a card is about to land here.
  target?: number
  // 0..1 pile shrinking away when harvested.
  harvested?: number
}

// One field slot: a pile with its count badge, payout lines and button.
export const Field: React.FC<FieldProps> = ({ at, bean, count, info, button, bump = 0, glow = 0, target = 0, harvested = 0 }) => {
  const empty = bean === null || count === 0
  return (
    <div
      style={{
        position: "absolute",
        left: at.x - 140,
        top: at.y,
        width: 280,
        height: 520,
        padding: "36px 0 20px",
        borderRadius: 30,
        background: `rgba(60, 30, 10, ${0.22 + target * 0.1})`,
        border: `4px ${empty && !target ? "dashed" : "solid"} ${target ? COLORS.gold : empty ? "rgba(255, 246, 220, .4)" : "transparent"}`,
        boxShadow: `0 0 ${36 * Math.max(glow, target)}px rgba(246, 201, 56, ${0.55 * Math.max(glow, target)})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ position: "relative", width: CARD, height: CARD_H }}>
        {empty ? (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: BODY, fontWeight: 700, fontSize: 26, color: "#fff6dc" }}>Empty field</div>
        ) : (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${1 - harvested * 0.6})`, opacity: 1 - harvested }}>
            {count > 1 && <Card bean={bean!} width={CARD} style={{ position: "absolute", top: -12, filter: "brightness(.88)" }} />}
            {count > 2 && <Card bean={bean!} width={CARD} style={{ position: "absolute", top: -24, filter: "brightness(.8)", zIndex: -1 }} />}
            <Card bean={bean!} width={CARD} style={{ position: "absolute", top: 0 }} />
            <Badge count={count} bump={bump} />
          </div>
        )}
      </div>
      <div style={{ minHeight: 60, textAlign: "center", fontFamily: BODY, color: "#fff6dc", textShadow: "0 2px 0 rgba(0,0,0,.5)" }}>
        {info?.[0] && <div style={{ fontWeight: 800, fontSize: 28, color: "#ffe27a" }}>{info[0]}</div>}
        {info?.[1] && <div style={{ fontWeight: 700, fontSize: 22 }}>{info[1]}</div>}
      </div>
      {button && <Button label={button.label} gold={button.gold} pressed={button.pressed} />}
    </div>
  )
}

// A name plate: portrait (or the gold coin for you), name and coin count.
export const Plate: React.FC<{ at: Point; name: string; art?: string; coins: number; active?: boolean; scale?: number }> = ({ at, name, art, coins, active = false, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: at.x,
      top: at.y,
      transform: `translate(-50%, -50%) scale(${scale})`,
      display: "flex",
      alignItems: "center",
      gap: 18,
      padding: "12px 34px 12px 12px",
      borderRadius: 999,
      background: COLORS.panel,
      border: `4px solid ${active ? COLORS.gold : COLORS.ink}`,
      boxShadow: active ? `0 0 0 8px ${COLORS.gold}, 0 0 50px rgba(246, 201, 56, .6)` : "0 8px 20px rgba(0,0,0,.35)",
    }}
  >
    <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", border: `4px solid ${COLORS.gold}`, background: COLORS.gold, display: "grid", placeItems: "center" }}>
      <Img src={staticFile(`art/${art ?? "coin"}.webp`)} style={art ? { width: "100%", height: "100%", objectFit: "cover" } : { width: 70 }} />
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 44, color: COLORS.ink }}>{name}</span>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 36, color: COLORS.goldDark }}>
        {coins} {coins === 1 ? "coin" : "coins"}
      </span>
    </div>
  </div>
)

// The game's trade offer panel, close up.
export interface OfferProps {
  at: Point
  from: string
  get: BeanKey[]
  // Beans you give, beans you pick one of, or nothing at all.
  give: { beans: BeanKey[]; choice?: boolean } | "gift"
  pressed?: "No thanks" | "Deal!" | null
  press?: number
  // 0..1 slide in, 0..1 drop away.
  enter: number
  leave?: number
}

export const Offer: React.FC<OfferProps> = ({ at, from, get, give, pressed = null, press = 0, enter, leave = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: at.x,
      top: at.y,
      width: 820,
      transform: `translate(-50%, -50%) translateY(${(1 - enter) * 60 + leave * 80}px) scale(${0.94 + enter * 0.06 - leave * 0.1})`,
      opacity: Math.min(enter, 1 - leave),
      padding: "26px 34px 30px",
      borderRadius: 26,
      background: COLORS.panel,
      border: `4px solid ${COLORS.ink}`,
      boxShadow: "0 24px 50px rgba(0,0,0,.45)",
      color: COLORS.ink,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <Img src={staticFile(`art/${from.toLowerCase()}.webp`)} style={{ width: 84, height: 84, borderRadius: "50%", border: `4px solid ${COLORS.gold}` }} />
      <div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 44 }}>{from} wants to trade</div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 24, color: COLORS.muted }}>Traded cards must be planted this turn.</div>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34, margin: "22px 0 26px" }}>
      <Side label="You get">
        {get.map((bean, index) => <Card key={index} bean={bean} width={150} />)}
      </Side>
      <div style={{ fontSize: 56, color: COLORS.muted, fontFamily: BODY }}>⇄</div>
      <Side label={give !== "gift" && give.choice ? "You give one of" : "You give"}>
        {give === "gift" ? (
          <div style={{ width: 300, fontFamily: BODY, fontWeight: 800, fontSize: 30, color: COLORS.muted, textAlign: "center" }}>Nothing, it's a gift</div>
        ) : (
          give.beans.map((bean, index) => (
            <div key={index} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
              <Card bean={bean} width={150} />
              {give.choice && <Button label="Give" gold size={20} />}
            </div>
          ))
        )}
      </Side>
    </div>
    <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
      <Button label="No thanks" pressed={pressed === "No thanks" ? press : 0} />
      <Button label="Make my own offer" />
      {give === "gift" && <Button label="Deal!" gold pressed={pressed === "Deal!" ? press : 0} />}
    </div>
  </div>
)

const Side: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
    <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 28 }}>{label}</div>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minHeight: 210 }}>{children}</div>
  </div>
)

// A speech bubble from a bot, as the game shows their replies.
export const Bubble: React.FC<{ at: Point; text: string; pop: number }> = ({ at, text, pop }) => (
  <div
    style={{
      position: "absolute",
      left: at.x,
      top: at.y,
      transform: `translate(-50%, -100%) scale(${pop})`,
      transformOrigin: "50% 100%",
      padding: "16px 30px",
      borderRadius: 30,
      background: "#fff",
      border: `4px solid ${COLORS.ink}`,
      boxShadow: `0 6px 0 ${COLORS.ink}`,
      fontFamily: BODY,
      fontWeight: 800,
      fontSize: 38,
      color: COLORS.ink,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
)

// The mouse pointer, gliding between keyframes and pressing on clicks.
export interface CursorKey {
  frame: number
  at: Point
}

export const Cursor: React.FC<{ frame: number; keys: CursorKey[]; clicks: number[]; show?: [number, number] }> = ({ frame, keys, clicks, show }) => {
  if (show && (frame < show[0] || frame > show[1])) return null
  let at = keys[0].at
  for (let index = 1; index < keys.length; index++) {
    const from = keys[index - 1]
    const to = keys[index]
    if (frame >= to.frame) at = to.at
    else if (frame > from.frame) {
      const t = Easing.inOut(Easing.cubic)((frame - from.frame) / (to.frame - from.frame))
      at = { x: from.at.x + (to.at.x - from.at.x) * t, y: from.at.y + (to.at.y - from.at.y) * t }
      break
    }
  }
  const press = clicks.reduce((total, click) => Math.max(total, pressAt(frame, click)), 0)
  const ripple = clicks.map((click) => frame - click).find((age) => age >= 0 && age < 16)
  return (
    <>
      {ripple !== undefined && (
        <div style={{ position: "absolute", left: at.x, top: at.y, width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: "50%", border: `5px solid ${COLORS.gold}`, transform: `scale(${0.3 + ripple / 12})`, opacity: 1 - ripple / 16 }} />
      )}
      <svg width={64} height={76} viewBox="0 0 32 38" style={{ position: "absolute", left: at.x - 6, top: at.y - 4, transform: `scale(${1 - press * 0.15})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.45))" }}>
        <path d="M3 2 L3 30 L10 23 L15 35 L20 33 L15 21 L25 21 Z" fill="#fff" stroke={COLORS.ink} strokeWidth={2.4} strokeLinejoin="round" />
      </svg>
    </>
  )
}

// 0..1..0 over the few frames of a click.
export const pressAt = (frame: number, click: number) => {
  const age = frame - click
  return age < -2 || age > 8 ? 0 : age < 0 ? (age + 2) / 2 : 1 - age / 8
}

// A card flying from one point to another on an arc, landing with a bounce.
export const flight = (frame: number, start: number, end: number, from: Point, to: Point, lift = 160) => {
  const t = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const eased = Easing.inOut(Easing.cubic)(t)
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased - Math.sin(eased * Math.PI) * lift,
    turn: Math.sin(eased * Math.PI) * -10,
    scale: 1 + Math.sin(eased * Math.PI) * 0.1,
    done: t >= 1,
  }
}

// 0..1 after `start` over `length` frames, with an overshoot.
export const pop = (frame: number, start: number, length = 14) => bounce(interpolate(frame, [start, start + length], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))

// 0..1..0 badge bump after a change.
export const bumpAt = (frame: number, start: number) => {
  const age = frame - start
  return age < 0 || age > 18 ? 0 : age / 18
}

// A card in flight or held somewhere on the table.
export const FlyingCard: React.FC<{ bean: BeanKey; x: number; y: number; turn?: number; scale?: number; width?: number }> = ({ bean, x, y, turn = 0, scale = 1, width = CARD }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${turn}deg) scale(${scale})`, zIndex: 5 }}>
    <Card bean={bean} width={width} />
  </div>
)

// Coins flying from a field up into a plate, one after another.
export const CoinTrail: React.FC<{ frame: number; start: number; count: number; from: Point; to: Point; gap?: number }> = ({ frame, start, count, from, to, gap = 6 }) => (
  <>
    {Array.from({ length: count }, (_, index) => {
      const begin = start + index * gap
      const t = interpolate(frame, [begin, begin + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      if (t <= 0 || t >= 1) return null
      const eased = Easing.inOut(Easing.quad)(t)
      const x = from.x + (to.x - from.x) * eased + Math.sin(eased * Math.PI) * (index % 2 ? 60 : -60)
      const y = from.y + (to.y - from.y) * eased - Math.sin(eased * Math.PI) * 120
      return <Img key={index} src={staticFile("art/coin.webp")} style={{ position: "absolute", left: x, top: y, width: 92, transform: `translate(-50%, -50%) scaleX(${Math.cos(t * 9)})`, zIndex: 6, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.4))" }} />
    })}
  </>
)

// How many of `count` coins have arrived by now, for the plate's counter.
export const coinsArrived = (frame: number, start: number, count: number, gap = 6) =>
  Array.from({ length: count }, (_, index) => start + index * gap + 22).filter((arrive) => frame >= arrive).length
