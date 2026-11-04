import { Game, Hand, IllegalMove, seededRandom, type Player } from "../engine"
import type { BeanKey, BotLevel, Move, TradeOffer } from "../types"
import {
  ACTIVE_PLAYER_MOVES,
  BID_MOVES,
  BOT_NAMES,
  HUMAN_INDEX,
  MAX_BOTS,
  MAX_UNDOS,
  MIN_BOTS,
  OFFER_ANSWERS,
  UNDOABLE_EVENTS,
  UNDOABLE_MOVES,
  botRunner,
  engineOf,
  isBotLevel,
  type SavedGame,
  type UndoState,
} from "./games"

export type QuoteAnswer = "accept" | "decline" | "missing"

export interface QuoteEntry {
  player: number
  answer: QuoteAnswer
  // A smaller deal the bot would take after saying no: what you'd give and get.
  counter?: { give: BeanKey[]; ask: BeanKey[] }
}

type Picks = Omit<TradeOffer, "partner_index">

// Deals a new game and lets the bots play until it is the human's move.
// `seed` makes the deal repeatable in tests and sims.
export function createGame({ id, botCount, botLevel, seed }: { id: number; botCount: number; botLevel: string; seed?: number }): SavedGame {
  if (!Number.isInteger(botCount) || botCount < MIN_BOTS || botCount > MAX_BOTS) throw new IllegalMove(`Choose ${MIN_BOTS} to ${MAX_BOTS} bots`)
  if (!isBotLevel(botLevel)) throw new IllegalMove("Choose easy, normal or smart bots")

  // the human always sits in seat 0, followed by the bots
  const names = ["You", ...BOT_NAMES.slice(0, botCount)]
  const engine = Game.start({ names, random: seed === undefined ? Math.random : seededRandom(seed) })
  const saved: SavedGame = { id, human_index: HUMAN_INDEX, bot_level: botLevel as BotLevel, state: engine.toJSON(), undo_states: [] }
  botRunner(saved, engine).run()
  return { ...saved, state: engine.toJSON() }
}

// Applies the human's move, lets the bots answer, and returns the new save.
// Throws IllegalMove for a move the rules don't allow; the old save is untouched.
export function makeMove(saved: SavedGame, move: Move): SavedGame {
  return new MoveMaker(saved, move).call()
}

// Asks every bot what it would say to an offer, without trading anything.
export function quoteTrade(saved: SavedGame, picks: Picks): QuoteEntry[] {
  const engine = engineOf(saved)
  const bidding = engine.bidding === saved.human_index
  if (!bidding && (engine.activeIndex !== saved.human_index || engine.phase !== "trade")) throw new IllegalMove("Wait for your turn")

  if (bidding) return [{ player: engine.activeIndex, answer: bidAnswer(saved, engine, picks) }]

  const runner = botRunner(saved, engine)
  const offered = offeredCards(engine, picks)
  return runner.botIndexes().map((index) => ({ player: index, ...answerFor(saved, engine, index, offered, picks) }))
}

// While bidding only the active bot answers: your hand cards for its face-up
// cards and the beans you ask it for.
function bidAnswer(saved: SavedGame, engine: Game, picks: Picks): QuoteAnswer {
  if (engine.activePlayer.hand.indexesOf(askedBeans(picks)) === null) return "missing"

  const [offered, requested] = bidCards(saved, engine, picks)
  return botRunner(saved, engine).bot(engine.activeIndex).accepts({ offered, requested }) ? "accept" : "decline"
}

function answerFor(saved: SavedGame, engine: Game, index: number, offered: BeanKey[], picks: Picks): Omit<QuoteEntry, "player"> {
  const partner = engine.players[index] as Player
  const handIndexes = partner.hand.indexesOf(askedBeans(picks))
  if (handIndexes === null) return { answer: "missing" }

  const requested = handIndexes.map((handIndex) => partner.hand.cards[handIndex] as BeanKey)
  const bot = botRunner(saved, engine).bot(index)
  if (bot.accepts({ offered, requested })) return { answer: "accept" }

  const counter = bot.counterOffer({ offered, requested })
  if (counter === null) return { answer: "decline" }

  return { answer: "decline", counter: { give: counter.offered, ask: counter.requested } }
}

class MoveMaker {
  private readonly saved: SavedGame
  private readonly move: Move
  private engine: Game
  private undoStates: UndoState[]
  // The log is the largest part of the state and undo can rebuild it, so it isn't kept.
  private readonly stateBefore: UndoState

  constructor(saved: SavedGame, move: Move) {
    this.saved = saved
    this.move = move
    this.engine = engineOf(saved)
    this.undoStates = [...saved.undo_states]
    const { log: _log, ...stateBefore } = this.engine.toJSON()
    this.stateBefore = stateBefore
  }

  call(): SavedGame {
    this.applyMove()
    botRunner(this.saved, this.engine).run()
    this.rememberUndo()
    this.drawIfNothingToUndo()
    return { ...this.saved, state: this.engine.toJSON(), undo_states: this.undoStates }
  }

  private applyMove(): void {
    this.checkTurn()
    this.checkOffer()
    this.checkBidding()

    const move = this.move
    switch (move.type) {
      case "undo":
        return this.undo()
      case "plant_from_hand":
        return this.engine.plantFromHand(number(move.field_index, "field_index"))
      case "flip_cards":
        return this.engine.flipCards()
      case "trade":
        return this.trade(move)
      case "end_trading":
        return this.engine.endTrading()
      case "draw_cards":
        return this.engine.drawCards()
      case "plant_pending":
        return this.engine.plantPending({
          playerIndex: this.humanIndex,
          pendingIndex: number(move.pending_index, "pending_index"),
          fieldIndex: number(move.field_index, "field_index"),
        })
      case "harvest":
        return this.engine.harvest({ playerIndex: this.humanIndex, fieldIndex: number(move.field_index, "field_index") })
      case "buy_third_field":
        return this.engine.buyThirdField({ playerIndex: this.humanIndex })
      case "accept_offer":
        return this.engine.acceptOffer({ bean: move.bean })
      case "decline_offer":
        return this.engine.declineOffer()
      case "open_bids":
        return this.engine.openBids()
      case "bid":
        return this.bid(move)
      case "close_bids":
        return this.engine.closeBids()
      default:
        throw new IllegalMove(`Unknown move: ${(move as { type: unknown }).type}`)
    }
  }

  // Puts the table back as it was before the human's last undoable move.
  private undo(): void {
    const state = this.undoStates.pop()
    if (state === undefined) throw new IllegalMove("There's nothing to undo")

    const log = this.engine.log.filter((event) => event.seq <= state.event_seq)
    this.engine = Game.fromJSON({ ...state, log })
  }

  // Keeps the state from before an undoable move, as long as the move revealed
  // nothing and no bot acted; anything else wipes the history.
  private rememberUndo(): void {
    if (this.move.type === "undo") return

    this.undoStates = this.isUndoable() ? [...this.undoStates, this.stateBefore].slice(-MAX_UNDOS) : []
  }

  // Your turn waits at the draw only while your last plant can still be undone;
  // otherwise the draw would just be one more tap.
  private drawIfNothingToUndo(): void {
    if (this.engine.phase !== "draw" || this.engine.activeIndex !== this.humanIndex || this.undoStates.length > 0) return

    this.engine.drawCards()
    botRunner(this.saved, this.engine).run()
  }

  private isUndoable(): boolean {
    if (!UNDOABLE_MOVES.includes(this.move.type)) return false

    const seen = this.stateBefore.event_seq
    return this.engine.log.every((event) => event.seq <= seen || UNDOABLE_EVENTS.includes(event.type))
  }

  private checkTurn(): void {
    if (!ACTIVE_PLAYER_MOVES.includes(this.move.type)) return
    if (this.engine.activeIndex === this.humanIndex) return

    throw new IllegalMove("Wait for your turn")
  }

  // only the human can answer an offer, and only one made to them
  private checkOffer(): void {
    if (!OFFER_ANSWERS.includes(this.move.type)) return
    if (this.engine.offer?.partner_index === this.humanIndex) return

    throw new IllegalMove("There is no offer waiting for you")
  }

  // only while the human has opened bidding on a bot's turn
  private checkBidding(): void {
    if (!BID_MOVES.includes(this.move.type)) return
    if (this.engine.bidding === this.humanIndex) return

    throw new IllegalMove("Make your own offer from a bot's deal first")
  }

  // Your hand cards for the active bot's face-up cards and the beans you ask it for.
  private bid(picks: Picks): void {
    const [gives, gets] = bidCards(this.saved, this.engine, picks)
    const bot = botRunner(this.saved, this.engine).bot(this.engine.activeIndex)
    if (!bot.accepts({ offered: gives, requested: gets })) throw new IllegalMove(`${this.engine.activePlayer.name} turned down your offer`)

    this.engine.bid({
      faceUpIndexes: numbers(picks.face_up_indexes, "face_up_indexes"),
      activeBeans: askedBeans(picks),
      bidderHandIndexes: numbers(picks.hand_indexes, "hand_indexes"),
    })
  }

  // bots decide straight away, so a trade either happens or is turned down
  private trade(offer: TradeOffer): void {
    const partnerIndex = number(offer.partner_index, "partner_index")
    if (partnerIndex === this.humanIndex) throw new IllegalMove("You can't trade with yourself")

    const partner = this.engine.players[partnerIndex]
    if (!partner) throw new IllegalMove(`There is no player ${partnerIndex}`)

    // The human can't see a bot's hand, so they ask for bean types, as at a real table.
    const partnerHandIndexes = partner.hand.indexesOf(askedBeans(offer))
    if (partnerHandIndexes === null) throw new IllegalMove(`${partner.name} doesn't have those beans to give`)

    const requested = partnerHandIndexes.map((index) => partner.hand.cards[index] as BeanKey)
    const bot = botRunner(this.saved, this.engine).bot(partnerIndex)
    if (!bot.accepts({ offered: offeredCards(this.engine, offer), requested })) throw new IllegalMove(`${partner.name} turned down your offer`)

    this.engine.trade({
      partnerIndex,
      faceUpIndexes: numbers(offer.face_up_indexes, "face_up_indexes"),
      handIndexes: numbers(offer.hand_indexes, "hand_indexes"),
      partnerHandIndexes,
    })
  }

  private get humanIndex(): number {
    return this.saved.human_index
  }
}

// The picked cards from a row, checked so each one exists.
function pickedCards(row: Hand, indexes: unknown, key: string): BeanKey[] {
  const picked = numbers(indexes, key)
  row.check(picked)
  return picked.map((index) => row.cards[index] as BeanKey)
}

// The face-up and hand cards the active human offers.
function offeredCards(engine: Game, picks: Picks): BeanKey[] {
  return [...pickedCards(engine.faceUp, picks.face_up_indexes, "face_up_indexes"), ...pickedCards(engine.activePlayer.hand, picks.hand_indexes, "hand_indexes")]
}

// While bidding: what the bot is offered (the human's hand cards) and what it gives up.
function bidCards(saved: SavedGame, engine: Game, picks: Picks): [BeanKey[], BeanKey[]] {
  const human = engine.players[saved.human_index] as Player
  const offered = pickedCards(human.hand, picks.hand_indexes, "hand_indexes")
  const requested = [...pickedCards(engine.faceUp, picks.face_up_indexes, "face_up_indexes"), ...askedBeans(picks)]
  return [offered, requested]
}

function askedBeans(picks: Picks): BeanKey[] {
  return Array.isArray(picks.partner_beans) ? picks.partner_beans.map(String) : []
}

function number(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new IllegalMove(`${key} must be a number`)
  return value
}

function numbers(values: unknown, key: string): number[] {
  if (values === undefined || values === null) return []
  if (!Array.isArray(values) || !values.every((value) => typeof value === "number" && Number.isInteger(value))) {
    throw new IllegalMove(`${key} must be a list of numbers`)
  }
  return values
}
