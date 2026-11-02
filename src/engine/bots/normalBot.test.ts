import { describe, expect, it } from "vitest"
import type { BeanKey } from "../../types"
import { Deck } from "../deck"
import { Field } from "../field"
import { Game } from "../game"
import { Hand } from "../hand"
import { Player } from "../player"
import { NormalBot } from "./normalBot"
import { SmartBot } from "./smartBot"

function field(bean: BeanKey | null = null, count = 0): Field {
  return new Field({ bean, count })
}

function player(name: string, hand: BeanKey[], { fields, coinCards = [] }: { fields?: Field[]; coinCards?: BeanKey[] } = {}): Player {
  return new Player({ name, hand: new Hand(hand), fields: fields ?? [field(), field()], coinCards })
}

function chiliDeck(): Deck {
  return new Deck({ drawPile: Array<BeanKey>(30).fill("chili") })
}

describe("NormalBot", () => {
  describe("#playTradePhase", () => {
    it("stops dealing with bots after its deals for the turn", () => {
      const cards = ["red", "wax", "stink", "green", "black_eyed"]
      const bot = player("Bot", ["soy"], { fields: [field("soy", 2), field("blue", 3)] })
      const human = player("You", [], { coinCards: ["red"] })
      const takers = cards.map((_card, index) => player(`Taker${index}`, [...cards]))
      const game = new Game({
        players: [bot, human, ...takers],
        deck: chiliDeck(),
        phase: "trade",
        faceUp: new Hand([...cards]),
        offersThisTurn: SmartBot.MAX_OFFERS_TO_HUMAN,
      })
      const partnerIndexes = takers.map((_taker, index) => index + 2)
      new NormalBot(game, 0).playTradePhase({ partnerIndexes, humanIndex: 1 })

      // The human has had their offers this turn, so the last card stays with the bot.
      expect(takers.reduce((sum, taker) => sum + taker.pending.length, 0)).toBe(NormalBot.MAX_BOT_DEALS)
      expect(bot.pending).toHaveLength(1)
      expect(game.offer).toBeNull()
    })
  })

  describe("#accepts", () => {
    function bot(): Player {
      return player("Bot", ["soy"], { fields: [field("soy", 3), field()] })
    }

    it("takes a lone gift a smart bot would turn down", () => {
      const game = new Game({ players: [player("Asker", []), bot()], deck: chiliDeck() })

      expect(new NormalBot(game, 1).accepts({ offered: ["blue"], requested: [] })).toBe(true)
      expect(new SmartBot(game, 1).accepts({ offered: ["blue"], requested: [] })).toBe(false)
    })

    it("helps a leader at the usual price", () => {
      const game = new Game({ players: [player("Asker", [], { coinCards: ["red", "red", "red"] }), bot()], deck: chiliDeck() })

      expect(new NormalBot(game, 1).accepts({ offered: ["soy"], requested: ["soy"] })).toBe(true)
    })
  })
})
