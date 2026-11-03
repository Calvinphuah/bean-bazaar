import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion"
import { Backdrop } from "./components/Backdrop"
import { Card } from "./components/Card"
import { Finish } from "./components/Finish"
import { Footage, type Shot } from "./components/Footage"
import { CoinBurst, Flash } from "./components/Particles"
import { Shake, type Impact } from "./components/Shake"
import { Stamp } from "./components/Stamp"
import { CAST, CAST_BEATS, CastPile, ColdOpen, MeetTheBeans, PILE_BEATS, SLAP_FRAMES } from "./scenes/Opening"
import { BotCallout, EndCard, GoldenReveal, Leaderboard } from "./scenes/Moments"
import { Soundtrack, type Cue } from "./Soundtrack"
import {
  BOTS_ACTS, BotsTradeScene, CASH_ACTS, COLLECT_ACTS, CashInScene, CollectScene, DECK_ACTS, DeckScene, EasyScene, GetRichScene,
  HAGGLE_ACTS, HARVEST_ACTS, HaggleScene, HarvestScene, PLANT_ACTS, PlantScene, RICH_ACTS, SEASON_ACTS, SeasonScene, TRADE_ACTS, TradeScene,
} from "./stage/Scenes"
import { DURATION, at, beats, cold, type Section } from "./timeline"

const URL = "bean-bazaar.calvinphuah.com"

// The middle of the game table, for the real footage behind the bot callouts.
type Spot = { x: number; y: number }
const WIDE: Spot = { x: 900, y: 430 }

// A locked-off shot: the play itself is what moves. (Slow drifts over the
// downscaled 4K UI made its small text shimmer.)
const hold = (spot: Spot, z: number, length: number): Shot[] => [
  { frame: 0, ...spot, z },
  { frame: length, ...spot, z },
]

const BOTS = [
  { bot: "Pinto", line: "Sorry, friend" },
  { bot: "Lima", line: "Do better" },
  { bot: "Fava", line: "Mine, all mine" },
  { bot: "Mung", line: "Not worth the risk" },
]
const BOT_BEATS = 2

const span = (section: Section, from: number, to: number) => ({ from: at(section, from), durationInFrames: at(section, to) - at(section, from) })

// A caption tag along the top of a gameplay shot.
const Caption: React.FC<{ text: string; from: number; to?: number; x?: number; y?: number }> = ({ text, from, to, x = 960, y = 120 }) => (
  <Sequence from={from} durationInFrames={to === undefined ? undefined : to - from} layout="none">
    <Stamp text={text} look="tag" size={72} x={x} y={y} />
  </Sequence>
)

const IMPACTS: Impact[] = [
  ...SLAP_FRAMES.map((frame, index) => ({ frame, strength: 6 + index * 3 })),
  { frame: at("bazaar"), strength: 16 },
  { frame: at("drop"), strength: 24 },
  { frame: at("drop", 3) + beats(RICH_ACTS.click) + 4, strength: 12 },
  { frame: at("payoff", 4), strength: 12 },
  ...PILE_BEATS.map((beat) => ({ frame: at("payoff", 8 + beat), strength: beat === 7 ? 12 : 4 })),
]

const stampAt = (section: Section, beat: number, gain = 1): Cue => ({ sound: "stamp", frame: at(section, beat) + 5, gain })
const tagAt = (frame: number): Cue => ({ sound: "card_take", frame, gain: 0.6 })

// A staged action beat within a section: `at` for a scene starting at `start`.
const act = (section: Section, start: number, beat: number) => at(section, start + beat)

const CUES: Cue[] = [
  // Cold open: three slaps in silence.
  ...SLAP_FRAMES.map((frame, index): Cue => ({ sound: "card_slap", frame, gain: 0.8 + index * 0.1 })),
  { sound: "impact_e", frame: SLAP_FRAMES[2], gain: 0.35 },
  // The cast, two beats each, then the fan.
  ...CAST.flatMap((_, index): Cue[] => [
    { sound: "whoosh_long", frame: at("meet", index * CAST_BEATS) + 8, gain: 0.2 },
    { sound: "card_take", frame: at("meet", index * CAST_BEATS) + 14, gain: 0.7 },
  ]),
  { sound: "riffle_shuffle", frame: at("meet", 14) + 4, gain: 0.7 },
  stampAt("meet", 14),
  // How it plays: plant, trade, harvest, every action on its beat.
  stampAt("play", 0, 0.6),
  { sound: "card_take", frame: act("play", 0, 0.55) },
  { sound: "card_slap", frame: act("play", 0, PLANT_ACTS.first), gain: 0.75 },
  { sound: "card_take", frame: act("play", 0, 2) },
  { sound: "card_slap", frame: act("play", 0, PLANT_ACTS.second), gain: 0.8 },
  stampAt("play", 4, 0.6),
  { sound: "whoosh_long", frame: at("play", 4) + 6, gain: 0.25 },
  { sound: "card_take", frame: act("play", 4, TRADE_ACTS.deal), gain: 0.9 },
  { sound: "card_slap", frame: act("play", 4, TRADE_ACTS.land), gain: 0.8 },
  stampAt("play", 8, 0.6),
  { sound: "card_take", frame: act("play", 8, HARVEST_ACTS.click), gain: 0.9 },
  { sound: "coins_box", frame: act("play", 8, HARVEST_ACTS.coins) + 22 },
  { sound: "coin_spin", frame: act("play", 8, HARVEST_ACTS.coins) + 30 },
  tagAt(at("play", 12) + 4),
  { sound: "whoosh_long", frame: act("play", 12, 1.2) + 8, gain: 0.3 },
  // But they're ruthless: the bots, and a real haggle.
  { sound: "riser_hit", frame: at("bazaar"), gain: 0.8 },
  { sound: "impact_e", frame: at("bazaar") },
  stampAt("bazaar", 0),
  ...BOTS.map((_, index): Cue => ({ sound: "cartoon_slap", frame: at("bazaar", 2 + index * BOT_BEATS) + 2, gain: 0.6 })),
  { sound: "whoosh_long", frame: at("bazaar", 10) + 6, gain: 0.25 },
  tagAt(act("bazaar", 10, 0.5)),
  { sound: "card_take", frame: act("bazaar", 10, HAGGLE_ACTS.no), gain: 0.9 },
  { sound: "cartoon_slap", frame: act("bazaar", 10, HAGGLE_ACTS.reply), gain: 0.5 },
  tagAt(act("bazaar", 10, HAGGLE_ACTS.second)),
  { sound: "card_take", frame: act("bazaar", 10, HAGGLE_ACTS.deal), gain: 0.9 },
  { sound: "card_slap", frame: act("bazaar", 10, HAGGLE_ACTS.land), gain: 0.8 },
  // The squeeze: last season, the deck, the Golden beans, a glow, silence.
  tagAt(at("squeeze") + 4),
  { sound: "impact_e", frame: act("squeeze", 0, SEASON_ACTS.fill), gain: 0.4 },
  tagAt(at("squeeze", 4) + 4),
  ...DECK_ACTS.flips.map((beat): Cue => ({ sound: "card_take", frame: act("squeeze", 4, beat) + 6, gain: 0.85 })),
  tagAt(at("squeeze", 8) + 4),
  ...COLLECT_ACTS.lands.map((beat, index): Cue => ({ sound: "card_slap", frame: act("squeeze", 8, beat), gain: 0.6 + index * 0.12 })),
  ...[12, 13, 14].map((beat, index): Cue => ({ sound: "stab", frame: at("squeeze", beat), gain: 0.4 + index * 0.12 })),
  { sound: "riser_wildfire", frame: at("drop"), gain: 0.9 },
  { sound: "riser_hit", frame: at("drop") },
  // The drop: strike gold, get rich, the bots trading, cashing in, the race.
  { sound: "braam_drop", frame: at("drop"), seconds: 3 },
  { sound: "magic_impact", frame: at("drop") + 30 },
  { sound: "mystical_chime", frame: at("drop") + 36 },
  { sound: "sparkle_long", frame: at("drop") + 40 },
  stampAt("drop", 1),
  { sound: "card_take", frame: act("drop", 3, RICH_ACTS.click), gain: 0.9 },
  { sound: "impact_e", frame: act("drop", 3, RICH_ACTS.click) + 4, gain: 0.6 },
  { sound: "coins_spill", frame: act("drop", 3, RICH_ACTS.coins) + 4, seconds: 2.2 },
  { sound: "coin_pile", frame: act("drop", 3, RICH_ACTS.coins) + 22 },
  stampAt("drop", 4, 0.8),
  tagAt(at("drop", 6) + 4),
  { sound: "whoosh_long", frame: act("drop", 6, BOTS_ACTS.swap) + 8, gain: 0.35 },
  { sound: "card_take", frame: act("drop", 6, BOTS_ACTS.done), gain: 0.8 },
  tagAt(at("drop", 9) + 4),
  ...CASH_ACTS.harvests.map((beat): Cue => ({ sound: "coins_box", frame: act("drop", 9, beat) + 28, gain: 0.8 })),
  tagAt(at("drop", 12) + 4),
  ...[12.5, 13.5, 14.5].map((beat): Cue => ({ sound: "coins_clink", frame: at("drop", beat), gain: 0.5, seconds: 0.6 })),
  { sound: "coin_pile", frame: at("drop", 15.3), gain: 0.8 },
  // The win, the tagline, the pile of cards.
  { sound: "coin_pile", frame: at("payoff") + 10 },
  { sound: "coins_clink", frame: at("payoff") + 20 },
  { sound: "impact_e", frame: at("payoff", 4) },
  stampAt("payoff", 4),
  stampAt("payoff", 5),
  ...PILE_BEATS.map((beat): Cue => ({ sound: "card_slap", frame: at("payoff", 8 + beat), gain: 0.55 + beat * 0.05 })),
  { sound: "magic_impact", frame: at("payoff", 15), gain: 0.5 },
  // The end card: cards rain, the sign drops into its ropes and creaks still.
  { sound: "riffle_shuffle", frame: at("logo") + 4, gain: 0.6 },
  { sound: "whoosh_bright", frame: at("logo") + 20, gain: 0.4 },
  { sound: "impact_e", frame: at("logo") + 36, gain: 0.5 },
  { sound: "creak", frame: at("logo") + 52, gain: 0.8 },
  { sound: "stamp", frame: at("logo") + 56, gain: 0.7 },
]

export const Trailer: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shake impacts={IMPACTS}>
      <Sequence from={0} durationInFrames={cold(4)}>
        <ColdOpen />
      </Sequence>

      <Sequence {...span("meet", 0, 16)}>
        <MeetTheBeans />
      </Sequence>

      {/* How it plays: plant, trade, harvest. "Easy, right?" sets up the turn. */}
      <Sequence {...span("play", 0, 4)}>
        <PlantScene />
        <Sequence from={4} layout="none">
          <Stamp text="PLANT." size={170} x={1430} y={470} tilt={-4} />
        </Sequence>
      </Sequence>
      <Sequence {...span("play", 4, 8)}>
        <TradeScene />
        <Sequence from={4} layout="none">
          <Stamp text="TRADE." size={150} x={1430} y={140} tilt={3} />
        </Sequence>
      </Sequence>
      <Sequence {...span("play", 8, 12)}>
        <HarvestScene />
        <Sequence from={4} layout="none">
          <Stamp text="HARVEST." size={170} x={1430} y={470} tilt={-3} />
        </Sequence>
      </Sequence>
      <Sequence {...span("play", 12, 16)}>
        <EasyScene />
        <Caption text="Easy, right?" from={4} x={730} y={950} />
      </Sequence>

      {/* But they're ruthless: meet the bots, then watch a real haggle */}
      <Sequence {...span("bazaar", 0, 2)}>
        <Footage clip="bots-play" from={540} camera={hold(WIDE, 1.15, beats(2))} dim={0.55} />
        <Flash strength={0.6} />
        <Stamp text="BUT RUTHLESS." size={190} tilt={2} />
      </Sequence>
      <Sequence {...span("bazaar", 2, 10)}>
        <AbsoluteFill style={{ filter: "blur(8px)" }}>
          <Footage clip="bots-play" from={1000} camera={hold(WIDE, 1.1, beats(8))} dim={0.55} />
        </AbsoluteFill>
        {BOTS.map((bot, index) => (
          <Sequence key={bot.bot} from={beats(index * BOT_BEATS)} durationInFrames={beats((index + 1) * BOT_BEATS) - beats(index * BOT_BEATS)}>
            <BotCallout {...bot} side={index % 2 ? -1 : 1} />
          </Sequence>
        ))}
      </Sequence>
      <Sequence {...span("bazaar", 10, 16)}>
        <HaggleScene />
        <Caption text="Say no..." from={beats(0.5)} to={beats(HAGGLE_ACTS.second)} x={730} y={950} />
        <Caption text="...and they sweeten the deal." from={beats(HAGGLE_ACTS.second)} x={730} y={950} />
      </Sequence>

      {/* The squeeze: last season, the deck runs low, the Golden beans */}
      <Sequence {...span("squeeze", 0, 4)}>
        <SeasonScene />
        <Caption text="Last season." from={4} y={190} />
      </Sequence>
      <Sequence {...span("squeeze", 4, 8)}>
        <DeckScene />
        <Caption text="The deck is running out." from={4} y={190} />
      </Sequence>
      <Sequence {...span("squeeze", 8, 12)}>
        <CollectScene />
        <Caption text="Collect beans..." from={4} y={960} />
      </Sequence>
      <Sequence {...span("squeeze", 12, 15)}>
        <Backdrop tint="#140c08" />
        <GoldenGlow />
      </Sequence>
      <Sequence {...span("squeeze", 15, 16)}>
        <AbsoluteFill style={{ background: "#000" }} />
      </Sequence>

      {/* The drop: strike gold, get rich, everyone cashing in, the race to the end */}
      <Sequence {...span("drop", 0, 3)}>
        <GoldenReveal />
        <Flash strength={1} length={18} />
        <Sequence from={beats(1)} layout="none">
          <Stamp text="STRIKE GOLD." size={170} y={920} tilt={-2} />
        </Sequence>
      </Sequence>
      <Sequence {...span("drop", 3, 6)}>
        <GetRichScene />
        <Sequence from={beats(RICH_ACTS.click) + 4} layout="none">
          <Flash strength={0.35} length={8} />
        </Sequence>
        <Sequence from={beats(1)} layout="none">
          <Stamp text="GET RICH." size={190} x={1380} y={480} tilt={-6} />
        </Sequence>
      </Sequence>
      <Sequence {...span("drop", 6, 9)}>
        <BotsTradeScene />
        <Caption text="The bots trade with each other too." from={4} y={960} />
      </Sequence>
      <Sequence {...span("drop", 9, 12)}>
        <CashInScene />
        <Caption text="Everyone's cashing in." from={4} y={960} />
      </Sequence>
      <Sequence {...span("drop", 12, 16)}>
        <Backdrop />
        <Leaderboard length={beats(4)} />
        <Caption text="Most coins wins." from={4} />
      </Sequence>

      {/* The win, the tagline, and the cast piling onto the table */}
      <Sequence {...span("payoff", 0, 4)}>
        <Footage clip="game-over" from={30} camera={hold({ x: 960, y: 540 }, 1.0, beats(4))} />
        <Sequence from={6} layout="none">
          <CoinBurst x={960} y={1150} count={60} power={1.25} seed="win" />
        </Sequence>
      </Sequence>
      <Sequence {...span("payoff", 4, 8)}>
        <Backdrop />
        <Stamp text="OUT-TRADE" size={220} y={420} tilt={-3} />
        <Sequence from={beats(1)} layout="none">
          <Stamp text="THE BAZAAR." size={220} y={660} tilt={2} />
        </Sequence>
      </Sequence>
      <Sequence {...span("payoff", 8, 16)}>
        <CastPile />
      </Sequence>

      <Sequence from={at("logo")} durationInFrames={DURATION - at("logo")}>
        <Backdrop />
        <EndCard url={URL} />
      </Sequence>
    </Shake>
    <Finish />
    <Soundtrack cues={CUES} />
  </AbsoluteFill>
)

// The breath before the drop: the Golden bean alone in the dark, slowly
// pushing in as its glow builds.
const GoldenGlow: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ transform: `scale(${1.3 + frame * 0.006}) rotate(-3deg)`, filter: `drop-shadow(0 0 ${30 + frame * 0.6}px rgba(255, 200, 80, .75))` }}>
        <Card bean="golden" width={430} />
      </div>
    </AbsoluteFill>
  )
}
