import { afterEach, describe, expect, it } from "vitest"
import type { BeanKey } from "../types"
import { BeanType } from "./beanType"
import { BotRunner } from "./botRunner"
import type { Bot, BotClass } from "./bots/bot"
import { SmartBot } from "./bots/smartBot"
import { Deck } from "./deck"
import { Field } from "./field"
import { Game } from "./game"
import { Hand } from "./hand"
import { Player } from "./player"
import { seededRandom } from "./random"

function cardTotal(game: Game): number {
  const seats = game.players.reduce(
    (sum, player) => sum + player.hand.size + player.pending.length + player.coins + player.fields.reduce((fieldSum, field) => fieldSum + field.count, 0),
    0,
  )
  return game.deck.drawPile.length + game.deck.discardPile.length + game.faceUp.size + seats
}

describe("BotRunner", () => {
  for (const playerCount of [3, 4, 5]) {
    it(`plays a full ${playerCount}-bot game to the end without losing a card`, () => {
      for (let seed = 0; seed < 5; seed++) {
        const names = Array.from({ length: playerCount }, (_name, index) => `Bot ${index}`)
        const game = Game.start({ names, random: seededRandom(seed) })
        new BotRunner(game, { humanIndex: null }).run()

        expect(game.isOver()).toBe(true)
        expect(cardTotal(game)).toBe(BeanType.fullDeck(playerCount).length)
        expect(game.winners()).not.toHaveLength(0)
      }
    })
  }

  it("stops when it is the human's turn", () => {
    const game = Game.start({ names: ["You", "Bot1", "Bot2"], random: seededRandom(1) })
    new BotRunner(game, { humanIndex: 0 }).run()

    expect(game.activeIndex).toBe(0)
    expect(game.phase).toBe("plant")
  })

  it("plays the bots' turns and hands back to the human", () => {
    const game = Game.start({ names: ["You", "Bot1", "Bot2"], random: seededRandom(1) })
    game.plantFromHand(0)
    game.flipCards()
    game.endTrading()
    const runner = new BotRunner(game, { humanIndex: 0 })
    runner.run()
    // Plant the human's cards the way a bot would, then let the bots finish the round.
    runner.bot(0).plantPending()
    runner.run()

    expect(game.activeIndex).toBe(0)
    expect(cardTotal(game)).toBe(BeanType.fullDeck(3).length)
  })

  it("waits while the human still has pending cards to plant", () => {
    const game = Game.start({ names: ["You", "Bot1", "Bot2"], random: seededRandom(2) })
    game.plantFromHand(0)
    game.flipCards()
    game.endTrading()
    new BotRunner(game, { humanIndex: 0 }).run()

    expect(game.phase).toBe("plant_pending")
    expect(game.players[0]?.pending).not.toHaveLength(0)
    expect(game.players.slice(1).map((player) => player.pending)).toEqual([[], []])
  })

  it("pauses while a smart bot's offer waits for the human", () => {
    const bot = new Player({ name: "Bot", fields: [new Field({ bean: "soy", count: 2 }), new Field({ bean: "blue", count: 2 })] })
    const human = new Player({ name: "You", hand: new Hand(["soy"]) })
    // Full fields of other beans, so this bot turns the red bean down and it goes to the human.
    const other = new Player({ name: "Other", fields: [new Field({ bean: "wax", count: 2 }), new Field({ bean: "green", count: 2 })] })
    const deck = new Deck({ drawPile: Array<BeanKey>(30).fill("chili") })
    const game = new Game({ players: [bot, human, other], deck, phase: "trade", faceUp: new Hand(["red"]) })
    new BotRunner(game, { humanIndex: 1, botClass: SmartBot }).run()

    expect(game.offer).toMatchObject({ partner_index: 1, choices: ["soy", "blue"] })
    expect(game.phase).toBe("trade")

    // Turned down, the swap comes back once as a gift, never as the same offer.
    game.declineOffer()
    new BotRunner(game, { humanIndex: 1, botClass: SmartBot }).run()

    expect(game.offer).toMatchObject({ partner_index: 1, choices: [] })

    game.declineOffer()
    new BotRunner(game, { humanIndex: 1, botClass: SmartBot }).run()

    expect(game.offer).toBeNull()
    expect(game.activeIndex).toBe(1)
  })

  describe("when the bots stop making progress", () => {
    const maxSteps = BotRunner.MAX_STEPS

    afterEach(() => {
      BotRunner.MAX_STEPS = maxSteps
    })

    it("throws", () => {
      const stuckBot = class {
        playPlantPhase(): void {}
        playTradePhase(): void {}
        plantPending(): void {}
        accepts(): boolean {
          return false
        }
        counterOffer(): null {
          return null
        }
      } satisfies new () => Bot
      const game = Game.start({ names: ["A", "B", "C"], random: seededRandom(1) })
      const runner = new BotRunner(game, { humanIndex: null, botClass: stuckBot as BotClass })
      BotRunner.MAX_STEPS = 3

      expect(() => runner.run()).toThrow("Bots made no progress after 3 steps")
    })
  })
})
