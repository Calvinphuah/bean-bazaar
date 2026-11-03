import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion"
import { Card } from "../components/Card"
import { CoinBurst } from "../components/Particles"
import { BODY, COLORS, type BeanKey } from "../theme"
import { beats } from "../timeline"
import { Bubble, CARD, CoinTrail, Cursor, Field, FlyingCard, Offer, Plate, Table, bumpAt, coinsArrived, flight, pop, pressAt, type Point } from "./Ui"

// Staged gameplay: each scene replays one moment of the game with the game's
// own UI, every action landing on a beat. `ACTS` lists those beats (from each
// scene's start), so captions and sounds can hit the same moments.

// The board, shared by every scene so the table never jumps between cuts.
const PLATE: Point = { x: 730, y: 150 }
const PLATE_COIN: Point = { x: 560, y: 150 }
const FIELD_TOP = 230
const FIELDS: Point[] = [{ x: 560, y: FIELD_TOP }, { x: 900, y: FIELD_TOP }]
const PILE = (field: Point): Point => ({ x: field.x, y: field.y + 36 + (CARD * 88) / 63 / 2 })
const HARVEST_BUTTON = (field: Point): Point => ({ x: field.x + 10, y: field.y + 470 })
// The offer panel sits beside the fields; its buttons and card measured from a render.
const OFFER: Point = { x: 1470, y: 560 }
const OFFER_NO: Point = { x: 1240, y: 760 }
const OFFER_DEAL: Point = { x: 1735, y: 760 }
const OFFER_GET: Point = { x: 1265, y: 585 }
const HAND_Y = 850
const HAND: BeanKey[] = ["blue", "chili", "stink", "soy", "soy"]
const handX = (index: number, count: number) => 730 + (index - (count - 1) / 2) * 150

const b = beats

// The hand along the bottom; the rightmost card is planted next.
const Hand: React.FC<{ cards: BeanKey[]; shift?: number }> = ({ cards, shift = 0 }) => (
  <>
    {cards.map((bean, index) => (
      <div key={index} style={{ position: "absolute", left: handX(index, cards.length) + shift, top: HAND_Y, transform: `translate(-50%, 0) rotate(${(index - (cards.length - 1) / 2) * 3}deg)` }}>
        <Card bean={bean} width={CARD} />
        {index === cards.length - 1 && (
          <div style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%) rotate(-4deg)", padding: "4px 16px", borderRadius: 999, background: COLORS.accent, border: `3px solid ${COLORS.ink}`, color: "#fff", fontFamily: BODY, fontWeight: 800, fontSize: 22, whiteSpace: "nowrap" }}>Plant next</div>
        )}
      </div>
    ))}
  </>
)

// Plant: the next card goes into an empty field, then the one after it on top.
export const PLANT_ACTS = { first: 1, second: 2.5 }
export const PlantScene: React.FC = () => {
  const frame = useCurrentFrame()
  const firstGrab = b(0.55)
  const firstLand = b(PLANT_ACTS.first)
  const secondGrab = b(2.0)
  const secondLand = b(PLANT_ACTS.second)
  const first = flight(frame, firstGrab, firstLand, { x: handX(4, 5), y: HAND_Y + 140 }, PILE(FIELDS[0]))
  const second = flight(frame, secondGrab, secondLand, { x: handX(3, 5), y: HAND_Y + 140 }, PILE(FIELDS[0]), 120)
  const handCards = frame < firstGrab ? HAND : frame < secondGrab ? HAND.slice(0, 4) : HAND.slice(0, 3)
  const count = frame >= secondLand ? 2 : frame >= firstLand ? 1 : 0
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={PLATE} name="You" coins={0} active />
      <Field at={FIELDS[0]} bean={count ? "soy" : null} count={count} info={count === 2 ? ["1 coin", "2 more for 2 coins"] : count === 1 ? ["", "1 more for 1 coin"] : undefined} bump={Math.max(bumpAt(frame, firstLand), bumpAt(frame, secondLand))} target={frame < firstLand ? interpolate(frame, [firstGrab - 6, firstGrab], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0} />
      <Field at={FIELDS[1]} bean={null} count={0} />
      <Hand cards={handCards} />
      {frame >= firstGrab && frame < firstLand && <FlyingCard bean="soy" x={first.x} y={first.y} turn={first.turn} scale={first.scale} />}
      {frame >= secondGrab && frame < secondLand && <FlyingCard bean="soy" x={second.x} y={second.y} turn={second.turn} scale={second.scale} />}
      <Cursor frame={frame} keys={[{ frame: 0, at: { x: 1500, y: 980 } }, { frame: firstGrab, at: { x: handX(4, 5) + 20, y: HAND_Y + 60 } }, { frame: firstLand, at: { x: 600, y: 520 } }, { frame: secondGrab, at: { x: handX(3, 5) + 20, y: HAND_Y + 60 } }, { frame: secondLand, at: { x: 600, y: 520 } }, { frame: b(4), at: { x: 700, y: 700 } }]} clicks={[firstGrab, secondGrab]} />
    </AbsoluteFill>
  )
}

// Trade: Fava offers a free Coffee; you take it and it flies into your empty field.
export const TRADE_ACTS = { deal: 2, land: 3 }
export const TradeScene: React.FC = () => {
  const frame = useCurrentFrame()
  const deal = b(TRADE_ACTS.deal)
  const land = b(TRADE_ACTS.land)
  const card = flight(frame, deal + 4, land, OFFER_GET, PILE(FIELDS[1]), 140)
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={PLATE} name="You" coins={0} />
      <Field at={FIELDS[0]} bean="soy" count={2} info={["1 coin", "2 more for 2 coins"]} />
      <Field at={FIELDS[1]} bean={frame >= land ? "coffee" : null} count={frame >= land ? 1 : 0} info={frame >= land ? ["", "3 more for 1 coin"] : undefined} bump={bumpAt(frame, land)} target={frame >= deal && frame < land ? 1 : 0} />
      <Offer at={OFFER} from="Fava" get={["coffee"]} give="gift" pressed="Deal!" press={pressAt(frame, deal)} enter={pop(frame, 0, 16)} leave={interpolate(frame, [deal + 4, deal + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      {frame > deal + 4 && frame < land && <FlyingCard bean="coffee" x={card.x} y={card.y} turn={card.turn} scale={card.scale * 0.85} />}
      <Cursor frame={frame} keys={[{ frame: 0, at: { x: 1600, y: 1040 } }, { frame: deal, at: OFFER_DEAL }, { frame: b(4), at: { x: 1500, y: 900 } }]} clicks={[deal]} />
    </AbsoluteFill>
  )
}

// Harvest: the grown Soy field is cashed in; two coins fly up into your plate.
export const HARVEST_ACTS = { click: 1, coins: 1.4 }
export const HarvestScene: React.FC = () => {
  const frame = useCurrentFrame()
  const click = b(HARVEST_ACTS.click)
  const coins = b(HARVEST_ACTS.coins)
  const gone = interpolate(frame, [click + 2, click + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={PLATE} name="You" coins={coinsArrived(frame, coins, 2, 8)} active={frame > coins + 22} />
      <Field at={FIELDS[0]} bean={gone < 1 ? "soy" : null} count={gone < 1 ? 4 : 0} info={gone < 1 ? ["2 coins", "2 more for 3 coins"] : undefined} glow={gone < 1 ? 0.6 + Math.sin(frame / 8) * 0.3 : 0} harvested={gone} button={gone < 1 ? { label: "Harvest", pressed: pressAt(frame, click) } : undefined} />
      <Field at={FIELDS[1]} bean="coffee" count={1} info={["", "3 more for 1 coin"]} button={{ label: "Harvest" }} />
      <CoinTrail frame={frame} start={coins} count={2} from={PILE(FIELDS[0])} to={PLATE_COIN} gap={8} />
      <Cursor frame={frame} keys={[{ frame: 0, at: { x: 1300, y: 900 } }, { frame: click, at: HARVEST_BUTTON(FIELDS[0]) }, { frame: b(4), at: { x: 820, y: 900 } }]} clicks={[click]} />
    </AbsoluteFill>
  )
}

// The whole little board at rest, then the four bots slide in around it.
const SEATS: { name: string; art: string; at: Point; from: Point }[] = [
  { name: "Pinto", art: "pinto", at: { x: 1460, y: 180 }, from: { x: 2300, y: 180 } },
  { name: "Lima", art: "lima", at: { x: 1460, y: 420 }, from: { x: 2300, y: 420 } },
  { name: "Fava", art: "fava", at: { x: 1460, y: 660 }, from: { x: 2300, y: 660 } },
  { name: "Mung", art: "mung", at: { x: 1460, y: 900 }, from: { x: 2300, y: 900 } },
]
export const EasyScene: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={PLATE} name="You" coins={2} />
      <Field at={FIELDS[0]} bean={null} count={0} />
      <Field at={FIELDS[1]} bean="coffee" count={1} info={["", "3 more for 1 coin"]} />
      {SEATS.map((seat, index) => {
        const slide = pop(frame, b(1.2) + index * 4, 16)
        return <Plate key={seat.name} at={{ x: seat.from.x + (seat.at.x - seat.from.x) * slide, y: seat.at.y }} name={seat.name} art={seat.art} coins={3} scale={0.9} />
      })}
    </AbsoluteFill>
  )
}

// The haggle: Pinto asks for your Golden; you say no; he comes back with a gift.
export const HAGGLE_ACTS = { no: 2, reply: 2.3, second: 3, deal: 4.6, land: 5.5 }
const PINTO: Point = { x: 1470, y: 175 }
export const HaggleScene: React.FC = () => {
  const frame = useCurrentFrame()
  const no = b(HAGGLE_ACTS.no)
  const second = b(HAGGLE_ACTS.second)
  const deal = b(HAGGLE_ACTS.deal)
  const land = b(HAGGLE_ACTS.land)
  const card = flight(frame, deal + 4, land, OFFER_GET, PILE(FIELDS[1]), 140)
  const reply = frame >= b(HAGGLE_ACTS.reply) && frame < second + 10 ? pop(frame, b(HAGGLE_ACTS.reply), 12) : 0
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={PLATE} name="You" coins={2} />
      <Plate at={PINTO} name="Pinto" art="pinto" coins={3} active />
      <Field at={FIELDS[0]} bean="golden" count={1} info={["", "1 more for 2 coins"]} />
      <Field at={FIELDS[1]} bean={frame >= land ? "stink" : null} count={frame >= land ? 1 : 0} info={frame >= land ? ["", "2 more for 1 coin"] : undefined} bump={bumpAt(frame, land)} target={frame >= deal && frame < land ? 1 : 0} />
      {frame < no + 18 && (
        <Offer at={{ x: OFFER.x, y: OFFER.y + 30 }} from="Pinto" get={["stink"]} give={{ beans: ["golden", "black_eyed"], choice: true }} pressed="No thanks" press={pressAt(frame, no)} enter={pop(frame, 0, 16)} leave={interpolate(frame, [no + 4, no + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
      {reply > 0 && <Bubble at={{ x: PINTO.x - 120, y: PINTO.y - 60 }} text="“Sorry, friend”" pop={reply} />}
      {frame >= second && (
        <Offer at={OFFER} from="Pinto" get={["stink"]} give="gift" pressed="Deal!" press={pressAt(frame, deal)} enter={pop(frame, second, 16)} leave={interpolate(frame, [deal + 4, deal + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
      {frame > deal + 4 && frame < land && <FlyingCard bean="stink" x={card.x} y={card.y} turn={card.turn} scale={card.scale * 0.85} />}
      <Cursor frame={frame} keys={[{ frame: 0, at: { x: 1200, y: 1040 } }, { frame: no, at: { x: OFFER_NO.x, y: OFFER_NO.y + 30 } }, { frame: second + 10, at: { x: 1450, y: 980 } }, { frame: deal, at: OFFER_DEAL }, { frame: b(6), at: { x: 1500, y: 980 } }]} clicks={[no, deal]} />
    </AbsoluteFill>
  )
}

// Last season: the season bar fills its third segment.
export const SEASON_ACTS = { fill: 1 }
export const SeasonScene: React.FC = () => {
  const frame = useCurrentFrame()
  const fill = interpolate(frame, [b(SEASON_ACTS.fill) - 8, b(SEASON_ACTS.fill)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const thump = Math.sin(Math.min(1, Math.max(0, (frame - b(SEASON_ACTS.fill)) / 14)) * Math.PI) * 0.06
  return (
    <AbsoluteFill>
      <Table />
      <Deck at={{ x: 640, y: 540 }} left={16} />
      <div style={{ position: "absolute", left: 1210, top: 540, transform: `translate(-50%, -50%) scale(${1 + thump})`, display: "flex", alignItems: "center", gap: 30, padding: "28px 46px", borderRadius: 999, background: "rgba(43, 29, 20, .78)", border: `4px solid ${COLORS.ink}` }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 56, color: "#fff6dc", whiteSpace: "nowrap" }}>Season 3 of 3</span>
        <div style={{ display: "flex", gap: 14 }}>
          {[1, 1, fill].map((amount, index) => (
            <div key={index} style={{ width: 90, height: 26, borderRadius: 13, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
              <div style={{ width: `${amount * 100}%`, height: "100%", background: COLORS.gold, boxShadow: index === 2 ? `0 0 ${20 * fill}px ${COLORS.gold}` : "none" }} />
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// The draw pile with its card count, as the game shows it.
const Deck: React.FC<{ at: Point; left: number; bump?: number }> = ({ at, left, bump = 0 }) => (
  <div style={{ position: "absolute", left: at.x, top: at.y, transform: "translate(-50%, -50%)" }}>
    {[3, 2, 1].map((depth) => (
      <Card key={depth} bean="coffee" back width={CARD * 1.2} style={{ position: "absolute", top: depth * 6, left: depth * 2, filter: `brightness(${1 - depth * 0.1})` }} />
    ))}
    <Card bean="coffee" back width={CARD * 1.2} style={{ position: "relative" }} />
    <div style={{ position: "absolute", top: -26, right: -30, minWidth: 74, height: 74, display: "grid", placeItems: "center", borderRadius: 999, background: COLORS.panel, border: `4px solid ${COLORS.ink}`, fontFamily: BODY, fontWeight: 800, fontSize: 36, color: COLORS.ink, transform: `scale(${1 + Math.sin(bump * Math.PI) * 0.3})` }}>{left}</div>
  </div>
)

// The deck running out: a card flips off the pile on every beat, the count dropping.
export const DECK_ACTS = { flips: [0.5, 1.5, 2.5, 3.5] }
const FLIPPED: BeanKey[] = ["chili", "blue", "stink", "soy"]
const FLIP = 18
export const DeckScene: React.FC = () => {
  const frame = useCurrentFrame()
  const flips = DECK_ACTS.flips.map((beat) => b(beat))
  const done = flips.filter((flip) => frame >= flip + FLIP).length
  return (
    <AbsoluteFill>
      <Table />
      <Deck at={{ x: 640, y: 540 }} left={16 - done} bump={Math.max(0, ...flips.map((flip) => bumpAt(frame, flip + FLIP)))} />
      {flips.map((flip, index) => {
        if (frame < flip) return null
        const t = Easing.inOut(Easing.quad)(Math.min(1, (frame - flip) / FLIP))
        const target = { x: 1080 + index * 150, y: 540 + (index % 2 ? 14 : -14) }
        const x = 640 + (target.x - 640) * t
        const y = 540 + (target.y - 540) * t - Math.sin(t * Math.PI) * 120
        const turn = 180 - t * 180
        return (
          <div key={index} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) perspective(1600px) rotateY(${turn}deg) rotate(${(index - 1.5) * 4}deg)` }}>
            <div style={{ transform: turn > 90 ? "rotateY(180deg)" : undefined }}>
              <Card bean={FLIPPED[index]} back={turn > 90} width={CARD * 1.2} />
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

const GOLDEN_INFO: Record<number, [string, string]> = {
  1: ["", "1 more for 2 coins"],
  2: ["2 coins", "1 more for 3 coins"],
  3: ["3 coins", "1 more for 4 coins"],
  4: ["4 coins", "Fully grown, harvest it"],
}
const GOLDEN_FIELD: Point = { x: 960, y: 250 }

// Collect: Golden beans land on the pile one per beat, the badge climbing to 4.
export const COLLECT_ACTS = { lands: [1, 2, 3] }
export const CollectScene: React.FC = () => {
  const frame = useCurrentFrame()
  const lands = COLLECT_ACTS.lands.map((beat) => b(beat))
  const count = 1 + lands.filter((land) => frame >= land).length
  return (
    <AbsoluteFill>
      <Table />
      <Field at={GOLDEN_FIELD} bean="golden" count={count} info={GOLDEN_INFO[count]} glow={(count - 1) / 3} bump={Math.max(...lands.map((land) => bumpAt(frame, land)))} />
      {lands.map((land, index) => {
        const start = land - b(0.6)
        if (frame < start || frame >= land) return null
        const card = flight(frame, start, land, { x: 960 + (index - 1) * 500, y: 1250 }, PILE(GOLDEN_FIELD), 80)
        return <FlyingCard key={index} bean="golden" x={card.x} y={card.y} turn={card.turn * (index - 1)} scale={card.scale} />
      })}
    </AbsoluteFill>
  )
}

// Get rich: the full Golden field is harvested; four coins fly into your plate.
export const RICH_ACTS = { click: 0.4, coins: 0.7 }
export const GetRichScene: React.FC = () => {
  const frame = useCurrentFrame()
  const click = b(RICH_ACTS.click)
  const coins = b(RICH_ACTS.coins)
  const gone = interpolate(frame, [click + 2, click + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const field = { x: 700, y: 300 }
  const plate = { x: 700, y: 160 }
  return (
    <AbsoluteFill>
      <Table />
      <Field at={field} bean={gone < 1 ? "golden" : null} count={gone < 1 ? 4 : 0} info={gone < 1 ? GOLDEN_INFO[4] : undefined} glow={gone < 1 ? 1 : 0} harvested={gone} button={gone < 1 ? { label: "Harvest", pressed: pressAt(frame, click) } : undefined} />
      <CoinTrail frame={frame} start={coins} count={4} from={PILE(field)} to={{ x: 530, y: 160 }} gap={6} />
      <Sequence from={click + 4} layout="none">
        <CoinBurst x={PILE(field).x} y={PILE(field).y} count={22} power={1.0} seed="get-rich" size={80} />
      </Sequence>
      <Plate at={plate} name="You" coins={5 + coinsArrived(frame, coins, 4, 6)} active={frame > coins} />
      <Cursor frame={frame} keys={[{ frame: 0, at: { x: 1000, y: 1000 } }, { frame: click, at: HARVEST_BUTTON(field) }, { frame: b(3), at: { x: 900, y: 1000 } }]} clicks={[click]} />
    </AbsoluteFill>
  )
}

// Bots trading with each other: Lima's Coffee for Fava's Stink, cards crossing.
export const BOTS_ACTS = { swap: 0.8, done: 1.8 }
const LIMA: Point = { x: 520, y: 330 }
const FAVA: Point = { x: 1400, y: 330 }
export const BotsTradeScene: React.FC = () => {
  const frame = useCurrentFrame()
  const swap = b(BOTS_ACTS.swap)
  const done = b(BOTS_ACTS.done)
  const coffee = flight(frame, swap, done, { x: LIMA.x, y: 600 }, { x: FAVA.x, y: 600 }, 220)
  const stink = flight(frame, swap + 6, done + 6, { x: FAVA.x, y: 600 }, { x: LIMA.x, y: 600 }, -120)
  return (
    <AbsoluteFill>
      <Table />
      <Plate at={LIMA} name="Lima" art="lima" coins={0} active />
      <Plate at={FAVA} name="Fava" art="fava" coins={2} />
      {frame < swap ? <FlyingCard bean="coffee" x={LIMA.x} y={600} /> : frame < done ? <FlyingCard bean="coffee" x={coffee.x} y={coffee.y} turn={coffee.turn} scale={coffee.scale} /> : <FlyingCard bean="coffee" x={FAVA.x} y={600} />}
      {frame < swap + 6 ? <FlyingCard bean="stink" x={FAVA.x} y={600} /> : frame < done + 6 ? <FlyingCard bean="stink" x={stink.x} y={stink.y} turn={-stink.turn} scale={stink.scale} /> : <FlyingCard bean="stink" x={LIMA.x} y={600} />}
      {frame >= done + 8 && <Bubble at={{ x: LIMA.x, y: LIMA.y - 70 }} text="Traded Coffee for Stink" pop={pop(frame, done + 8, 12)} />}
    </AbsoluteFill>
  )
}

// Everyone cashing in: four players harvest in turn, coins flying into each plate.
export const CASH_ACTS = { harvests: [0.3, 0.9, 1.5, 2.1] }
const CASHERS: { name: string; art?: string; bean: BeanKey; count: number; coins: number; gain: number; info: string }[] = [
  { name: "You", bean: "chili", count: 7, coins: 5, gain: 2, info: "2 coins" },
  { name: "Lima", art: "lima", bean: "stink", count: 5, coins: 4, gain: 2, info: "2 coins" },
  { name: "Mung", art: "mung", bean: "blue", count: 8, coins: 6, gain: 3, info: "3 coins" },
  { name: "Fava", art: "fava", bean: "red", count: 4, coins: 3, gain: 3, info: "3 coins" },
]
export const CashInScene: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill>
      <Table />
      {CASHERS.map((player, index) => {
        const x = 270 + index * 460
        const field = { x, y: 330 }
        const click = b(CASH_ACTS.harvests[index])
        const gone = interpolate(frame, [click + 2, click + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        const plate = { x, y: 190 }
        return (
          <div key={player.name}>
            <Field at={field} bean={gone < 1 ? player.bean : null} count={gone < 1 ? player.count : 0} info={gone < 1 ? [player.info] : undefined} glow={gone < 1 ? 0.5 : 0} harvested={gone} button={gone < 1 ? { label: "Harvest", pressed: pressAt(frame, click) } : undefined} />
            <CoinTrail frame={frame} start={click + 6} count={player.gain} from={PILE(field)} to={{ x: x - 150, y: plate.y }} gap={6} />
            <Plate at={plate} name={player.name} art={player.art} coins={player.coins + coinsArrived(frame, click + 6, player.gain, 6)} scale={0.8} active={frame >= click && frame < click + 40} />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
