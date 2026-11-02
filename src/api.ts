import { IllegalMove } from "./engine"
import { createGame, makeMove, quoteTrade as quoteLocalTrade, type QuoteAnswer as LocalQuoteAnswer } from "./games/services"
import { engineOf, type SavedGame } from "./games/games"
import { serializeGame } from "./games/serializer"
import type { BeanKey, BotLevel, GameState, Move, TradeOffer } from "./types"

// The game runs in the browser: these calls play it on the local engine and
// keep it in localStorage, with the same shapes the Rails API used to send.

export type QuoteAnswer = LocalQuoteAnswer

// A smaller deal a bot would take after saying no: what you'd give and get.
export interface TradeCounter {
  give: BeanKey[]
  ask: BeanKey[]
}

export interface Quote {
  answers: { player: number; answer: QuoteAnswer; counter?: TradeCounter }[]
}

// Keeps an HTTP-like status, so a missing game can be told apart from a broken move.
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const SAVE_KEY = "bean-bazaar-save"

// The game in play; localStorage only keeps it across reloads.
let current: SavedGame | null = null

function store(saved: SavedGame): void {
  current = saved
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved))
  } catch {
    // Private windows can refuse storage; the game still plays, it just won't resume after a reload.
  }
}

function stored(id: number): SavedGame {
  if (current?.id === id) return current
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as SavedGame | null
    if (saved?.id === id) {
      current = saved
      return saved
    }
  } catch {
    // Unreadable or blocked storage counts as no saved game.
  }
  throw new ApiError("That game no longer exists", 404)
}

// Rule breaks explain themselves; anything else is a bug, so it gets the general message.
function play<T>(action: () => T, fallback: string): Promise<T> {
  try {
    return Promise.resolve(action())
  } catch (caught) {
    if (caught instanceof ApiError) return Promise.reject(caught)
    if (caught instanceof IllegalMove) return Promise.reject(new ApiError(caught.message, 422))

    console.error(caught)
    return Promise.reject(new ApiError(fallback, 500))
  }
}

export function startGame(botCount: number, botLevel: BotLevel): Promise<GameState> {
  return play(() => {
    const saved = createGame({ id: Date.now(), botCount, botLevel })
    store(saved)
    return serializeGame(saved, engineOf(saved))
  }, "The game couldn't be dealt, please try again")
}

export function loadGame(id: number): Promise<GameState> {
  return play(() => {
    const saved = stored(id)
    return serializeGame(saved, engineOf(saved))
  }, "Something went wrong, please try again")
}

export function sendMove(id: number, move: Move): Promise<GameState> {
  return play(() => {
    const saved = makeMove(stored(id), move)
    store(saved)
    return serializeGame(saved, engineOf(saved))
  }, "The move couldn't be saved, please try again")
}

// Asks every bot what it would say to an offer, without trading.
export function quoteTrade(id: number, offer: Omit<TradeOffer, "partner_index">): Promise<Quote> {
  return play(() => ({ answers: quoteLocalTrade(stored(id), offer) }), "The bots couldn't answer, please try again")
}
