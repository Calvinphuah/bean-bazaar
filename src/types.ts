// Mirrors Api::GameSerializer#as_json in the Rails API.
export type BeanKey = string

export type Phase = "plant" | "trade" | "plant_pending" | "over"

export type BotLevel = "easy" | "normal" | "smart"

export interface BeanType {
  key: BeanKey
  name: string
  copies: number
  // Coins earned ("1".."4") mapped to the beans needed.
  meter: Record<string, number>
}

export interface FieldState {
  bean: BeanKey | null
  count: number
}

export interface PlayerState {
  name: string
  // Only your own hand is sent; bots' hands are null.
  hand: BeanKey[] | null
  hand_size: number
  fields: FieldState[]
  coins: number
  pending: BeanKey[]
}

// discard_top is missing from tables logged before the discard pile was shown face up.
export interface DeckSummary { draw: number; discard: number; discard_top?: BeanKey[]; run_outs: number }

// What everyone can see at one moment; every log event carries one.
export interface TableSnapshot {
  phase: Phase
  active_index: number
  deck: DeckSummary
  face_up: BeanKey[]
  players: { hand_size: number; coins: number; fields: FieldState[]; pending: BeanKey[] }[]
}

export type EventType =
  | "plant" | "flip" | "trade" | "offer" | "decline" | "keep" | "harvest" | "buy_field" | "turn" | "final_harvest" | "game_over"

export interface LogEvent {
  seq: number
  type: EventType
  player: number | null
  text: string
  table: TableSnapshot
}

// A bot's offer waiting for you: it gives `give`, asks for `ask` from your hand.
export interface Offer {
  from: number
  give: BeanKey[]
  ask: BeanKey[]
  // Beans the bot would take instead of ask: you give any one of them.
  choices: BeanKey[]
}

export interface GameState {
  id: number
  you: number
  phase: Phase
  active_index: number
  hand_plants: number
  over: boolean
  winners: number[]
  deck: DeckSummary
  face_up: BeanKey[]
  players: PlayerState[]
  offer: Offer | null
  // You turned a bot's offer down to make your own; that bot waits for you.
  bidding: boolean
  bot_level: BotLevel
  // Your last plant, harvest or field purchase can be taken back.
  can_undo: boolean
  log: LogEvent[]
  bean_types: BeanType[]
}

// A card you've picked to give in a trade, and where it came from.
export interface TradeGive { bean: BeanKey; source: "face_up" | "hand"; index: number }

export interface TradeOffer {
  partner_index: number
  face_up_indexes: number[]
  hand_indexes: number[]
  partner_beans: BeanKey[]
}

export type Move =
  | { type: "plant_from_hand"; field_index: number }
  | { type: "flip_cards" }
  | { type: "undo" }
  | { type: "end_trading" }
  | { type: "buy_third_field" }
  | { type: "accept_offer"; bean?: BeanKey }
  | { type: "decline_offer" }
  | { type: "plant_pending"; pending_index: number; field_index: number }
  | { type: "harvest"; field_index: number }
  | ({ type: "trade" } & TradeOffer)
  | ({ type: "bid" } & Omit<TradeOffer, "partner_index">)
  | { type: "open_bids" }
  | { type: "close_bids" }
