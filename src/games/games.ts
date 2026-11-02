import type { BotLevel } from "../types"
import { BotRunner, Game, NormalBot, PERSONALITIES, SimpleBot, SmartBot, type BotClass, type GameData } from "../engine"

// Seat the human always takes; the bots sit after them.
export const HUMAN_INDEX = 0

// How many bots a human can play against.
export const MIN_BOTS = 2
export const MAX_BOTS = 4

// Bot seat names, in seating order: one per personality, so each seat plays its own way.
export const BOT_NAMES = Object.keys(PERSONALITIES)

// Bot difficulty, mapped to the bot class that plays it.
export const BOT_LEVELS: Readonly<Record<BotLevel, BotClass>> = { easy: SimpleBot, normal: NormalBot, smart: SmartBot }
export const DEFAULT_BOT_LEVEL: BotLevel = "normal"

// Moves only the active player can make; harvesting, buying a field and
// planting pending cards are allowed on any turn.
export const ACTIVE_PLAYER_MOVES = ["plant_from_hand", "flip_cards", "trade", "end_trading"]

// Answers to an offer a bot made to the human, allowed on the bot's turn.
// open_bids turns it down to make the human's own offers instead.
export const OFFER_ANSWERS = ["accept_offer", "decline_offer", "open_bids"]

// The human's own offers to the active bot, once they have opened bidding.
export const BID_MOVES = ["bid", "close_bids"]

// Moves the human can take back: they reveal no cards and no bot reacts to them.
export const UNDOABLE_MOVES = ["plant_from_hand", "harvest", "plant_pending", "buy_third_field"]
// Log events those moves may add; any other new event (a flip, a trade, a new turn)
// means something happened that can't be taken back.
export const UNDOABLE_EVENTS = ["plant", "harvest", "buy_field"]
// How many moves back the human can go.
export const MAX_UNDOS = 20

// A game state without its log, which undo rebuilds from the live one.
export type UndoState = Omit<GameData, "log">

// One saved game, the way the Rails app kept it in its games table.
export interface SavedGame {
  id: number
  human_index: number
  bot_level: BotLevel
  state: GameData
  undo_states: UndoState[]
}

export function isBotLevel(level: string): level is BotLevel {
  return Object.prototype.hasOwnProperty.call(BOT_LEVELS, level)
}

// A fresh engine built from the saved state.
export function engineOf(saved: SavedGame): Game {
  return Game.fromJSON(saved.state)
}

// Plays the bots in this game until the human has a move.
export function botRunner(saved: SavedGame, engine: Game): BotRunner {
  return new BotRunner(engine, { humanIndex: saved.human_index, botClass: BOT_LEVELS[saved.bot_level] })
}
