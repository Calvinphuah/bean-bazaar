import type { BeanKey, BotLevel, GameState, Move, TradeOffer } from "./types"

export type QuoteAnswer = "accept" | "decline" | "missing"

// A smaller deal a bot would take after saying no: what you'd give and get.
export interface TradeCounter {
  give: BeanKey[]
  ask: BeanKey[]
}

export interface Quote {
  answers: { player: number; answer: QuoteAnswer; counter?: TradeCounter }[]
}

// Keeps the HTTP status, so a missing game can be told apart from a network blip.
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Every response is wrapped in a root key (`game`, `quote`), success or error.
async function request<T>(path: string, root: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  })
  const body: unknown = await response.json().catch(() => null)
  const payload = typeof body === "object" && body !== null && root in body ? (body as Record<string, unknown>)[root] : null
  if (!response.ok) throw new ApiError(errorMessage(payload, response.status), response.status)

  // The API is the only producer of these shapes; trust it at this one boundary.
  return payload as T
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "error_message" in payload && typeof payload.error_message === "string") {
    return payload.error_message
  }
  return status === 404 ? "That game no longer exists" : "Something went wrong, please try again"
}

export function startGame(botCount: number, botLevel: BotLevel): Promise<GameState> {
  return request("/games", "game", { method: "POST", body: JSON.stringify({ bot_count: botCount, bot_level: botLevel }) })
}

export function loadGame(id: number): Promise<GameState> {
  return request(`/games/${id}`, "game")
}

export function sendMove(id: number, move: Move): Promise<GameState> {
  return request(`/games/${id}/moves`, "game", { method: "POST", body: JSON.stringify({ move }) })
}

// Asks every bot what it would say to an offer, without trading.
export function quoteTrade(id: number, offer: Omit<TradeOffer, "partner_index">): Promise<Quote> {
  return request(`/games/${id}/trade_quotes`, "quote", { method: "POST", body: JSON.stringify({ quote: offer }) })
}
