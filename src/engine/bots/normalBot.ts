import { SmartBot } from "./smartBot"

// Plays like SmartBot but trades more kindly, so a good player wins more often than at Smart.
export class NormalBot extends SmartBot {
  // Any gift that does it some good is welcome.
  static readonly KIND_GIFT_VALUE = 1
  // Deals among bots make them strong: with four a turn a good player wins about 40% of games.
  static readonly MAX_BOT_DEALS = 4

  // Once it has made its deals this turn, spare cards go to the human instead.
  protected offer(partnerIndexes: number[], picks: { faceUpIndexes?: number[]; handIndexes?: number[] }): boolean {
    if (this.dealsThisTurn() < NormalBot.MAX_BOT_DEALS) return super.offer(partnerIndexes, picks)

    // Only one offer can wait at a time; the giving stops until the human answers.
    return this.game.offer === null && this.giftToHuman(picks.faceUpIndexes ?? [], picks.handIndexes ?? [])
  }

  // Trades made since its turn began, read from the log.
  protected dealsThisTurn(): number {
    let deals = 0
    for (const event of [...this.game.log].reverse()) {
      if (event.type === "turn") break
      if (event.type === "trade") deals += 1
    }
    return deals
  }

  protected minGiftValue(): number {
    return NormalBot.KIND_GIFT_VALUE - this.personality.giftKindness
  }

  protected helpCost(): number {
    return SmartBot.HELP_COST
  }
}
