import { SmartBot, botRunner, createGame, engineOf, seededRandom } from "../.engine/engine-entry.js"

const HUMAN = 0
const PARTNERS = [1, 2, 3, 4]

// Plays the human seat with the smart bot, step by step, and stops at the first
// state where `moment(engine)` holds; returns it as a save the browser can load.
export function findMoment({ seed, botLevel = "normal", botCount = 4, moment, maxSteps = 2000 }) {
  // Reshuffles and bot choices fall back to Math.random, so seed it too for repeatable games.
  Math.random = seededRandom(seed * 7919)
  let saved = createGame({ id: seed, botCount, botLevel, seed })
  for (let step = 0; step < maxSteps; step++) {
    const engine = engineOf(saved)
    if (moment(engine)) return { ...saved, state: engine.toJSON(), undo_states: [] }
    if (engine.isOver()) return null

    playHuman(engine)
    const next = { ...saved, state: engine.toJSON() }
    botRunner(next, engine).run()
    saved = { ...next, state: engine.toJSON() }
  }
  return null
}

function playHuman(engine) {
  const me = new SmartBot(engine, HUMAN)
  const player = engine.players[HUMAN]
  if (engine.offer?.partner_index === HUMAN) return answerOffer(engine, me)
  if (engine.phase === "plant_pending" && player.pending.length > 0) return me.plantPending()
  if (engine.activeIndex !== HUMAN) return
  if (engine.phase === "draw") return engine.drawCards()
  if (engine.phase === "plant") return me.playPlantPhase()
  if (engine.phase === "trade") return me.playTradePhase({ partnerIndexes: PARTNERS.filter((i) => i < engine.players.length), humanIndex: null })
}

// Takes a bot's offer when the smart bot would, giving the first choice it holds.
function answerOffer(engine, me) {
  const offer = engine.offer
  const giver = engine.activePlayer
  const offered = [...offer.face_up_indexes.map((i) => engine.faceUp.toJSON()[i]), ...offer.hand_indexes.map((i) => giver.hand.toJSON()[i])]
  const held = engine.players[HUMAN].hand.toJSON()
  const bean = offer.choices.find((choice) => held.includes(choice)) ?? null
  if (offer.choices.length > 0 && bean === null) return engine.declineOffer()
  const requested = [...offer.partner_beans, ...(bean ? [bean] : [])]
  if (!me.accepts({ offered, requested })) return engine.declineOffer()
  try {
    engine.acceptOffer({ bean })
  } catch {
    engine.declineOffer()
  }
}

export const you = (engine) => engine.players[HUMAN]
export const yourPlantTurn = (engine) => engine.activeIndex === HUMAN && engine.phase === "plant" && engine.handPlants === 0

// The hero game: "You" collect all four Golden beans and win 14 to 13 against Normal bots.
export const HERO_SEED = 55

// The save at the nth state the hero game passes through (1-based, as the scan listed them).
export function heroMoment(n) {
  let seen = 0
  return findMoment({ seed: HERO_SEED, moment: (engine) => ++seen === n || (n === Infinity && engine.isOver()) })
}
