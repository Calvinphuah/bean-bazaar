import type { Bot, BotClass } from "./bots/bot"
import { SimpleBot } from "./bots/simpleBot"
import type { Game } from "./game"

// Lets the bots play until the human has something to do or the game ends.
// With no human (humanIndex: null) it plays a whole bots-only game.
export class BotRunner {
  static MAX_STEPS = 10_000

  private readonly game: Game
  private readonly humanIndex: number | null
  private readonly botClass: BotClass

  constructor(game: Game, { humanIndex, botClass = SimpleBot }: { humanIndex: number | null; botClass?: BotClass }) {
    this.game = game
    this.humanIndex = humanIndex
    this.botClass = botClass
  }

  run(): void {
    for (let step = 0; step < BotRunner.MAX_STEPS; step++) {
      if (this.game.phase === "plant_pending") this.botsPlantPending()
      if (this.game.isOver() || this.isWaitingForHuman()) return

      this.playActiveBot()
    }
    throw new Error(`Bots made no progress after ${BotRunner.MAX_STEPS} steps`)
  }

  bot(playerIndex: number): Bot {
    return new this.botClass(this.game, playerIndex)
  }

  botIndexes(): number[] {
    return this.game.players.map((_player, index) => index).filter((index) => index !== this.humanIndex)
  }

  private isWaitingForHuman(): boolean {
    if (this.humanIndex === null) return false
    if (this.game.offer?.partner_index === this.humanIndex) return true
    if (this.game.bidding === this.humanIndex) return true
    if (this.game.phase === "plant_pending") return (this.game.players[this.humanIndex]?.pending.length ?? 0) > 0

    return this.game.activeIndex === this.humanIndex
  }

  private botsPlantPending(): void {
    for (const index of this.botIndexes()) this.bot(index).plantPending()
  }

  // Only plant, trade and draw reach here; plant_pending is handled for every bot above.
  private playActiveBot(): void {
    if (this.game.phase === "draw") return this.game.drawCards()

    const activeBot = this.bot(this.game.activeIndex)
    if (this.game.phase === "plant") return activeBot.playPlantPhase()

    activeBot.playTradePhase({
      partnerIndexes: this.botIndexes().filter((index) => index !== this.game.activeIndex),
      humanIndex: this.humanIndex,
    })
  }
}
