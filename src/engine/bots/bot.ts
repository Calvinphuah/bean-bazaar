import type { BeanKey } from "../../types"
import type { Game } from "../game"

// A smaller deal a bot would take after saying no.
export interface CounterOffer {
  offered: BeanKey[]
  requested: BeanKey[]
}

export interface Deal {
  offered: BeanKey[]
  requested: BeanKey[]
}

// What BotRunner and the move checks call on a bot.
export interface Bot {
  playPlantPhase(): void
  playTradePhase(options: { partnerIndexes: number[]; humanIndex?: number | null }): void
  plantPending(): void
  accepts(deal: Deal): boolean
  counterOffer(deal: Deal): CounterOffer | null
}

export type BotClass = new (game: Game, playerIndex: number) => Bot
