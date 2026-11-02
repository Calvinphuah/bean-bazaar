import { beforeEach, describe, expect, it } from "vitest"
import type { BeanKey } from "../../types"
import { Deck } from "../deck"
import { Field } from "../field"
import { Game } from "../game"
import { Hand } from "../hand"
import { Player } from "../player"
import { SimpleBot } from "./simpleBot"

function player(name: string, hand: BeanKey[], { fields, coinCards = [] }: { fields?: Field[]; coinCards?: BeanKey[] } = {}): Player {
  return new Player({ name, hand: new Hand(hand), fields: fields ?? [new Field(), new Field()], coinCards })
}

function grown(): Field[] {
  return [new Field({ bean: "soy", count: 2 }), new Field({ bean: "blue", count: 2 })]
}

describe("SimpleBot", () => {
  let deck: Deck

  beforeEach(() => {
    deck = new Deck({ drawPile: ["green", "stink", "red", "red", "red"] })
  })

  describe("#playPlantPhase", () => {
    it("plants the front card, plants a second that fits, and flips", () => {
      const game = new Game({ players: [player("Bot", ["blue", "soy", "red"]), player("Other", [])], deck })
      new SimpleBot(game, 0).playPlantPhase()

      expect(game.players[0]?.fields.map((field) => field.bean)).toEqual(["blue", "soy"])
      expect(game.phase).toBe("trade")
    })

    it("harvests the most valuable field when nothing fits", () => {
      const fields = [new Field({ bean: "red", count: 3 }), new Field({ bean: "soy", count: 2 })]
      const game = new Game({ players: [player("Bot", ["blue"], { fields }), player("Other", [])], deck })
      new SimpleBot(game, 0).playPlantPhase()

      expect(game.players[0]?.fields.map((field) => field.bean)).toEqual(["blue", "soy"])
      expect(game.players[0]?.coins).toBe(2)
    })

    it("skips planting with an empty hand and buys a third field when it can", () => {
      const game = new Game({ players: [player("Bot", [], { coinCards: ["red", "red", "red"] }), player("Other", [])], deck })
      new SimpleBot(game, 0).playPlantPhase()

      expect(game.players[0]?.fields).toHaveLength(3)
      expect(game.phase).toBe("trade")
    })
  })

  describe("#playTradePhase", () => {
    it("swaps an unwanted face-up card for a bean it grows", () => {
      const bot = player("Bot", [], { fields: grown() })
      const partner = player("Partner", ["soy"], { fields: [new Field({ bean: "green", count: 1 }), new Field()] })
      const game = new Game({ players: [bot, partner], deck, phase: "trade", faceUp: new Hand(["green", "blue"]) })
      new SimpleBot(game, 0).playTradePhase({ partnerIndexes: [1] })

      expect(partner.pending).toEqual(["green"])
      expect(bot.pending).toEqual(["soy", "blue"])
      expect(game.phase).toBe("plant_pending")
    })

    it("asks only for its own bean, so a partner holding another one just gets a gift", () => {
      const bot = player("Bot", [], { fields: grown() })
      const partner = player("Partner", ["blue"])
      const game = new Game({ players: [bot, partner], deck, phase: "trade", faceUp: new Hand(["green"]) })
      new SimpleBot(game, 0).playTradePhase({ partnerIndexes: [1] })

      expect(partner.hand.cards).toEqual(["blue"])
      expect(partner.pending).toEqual(["green"])
    })

    it("gifts when it grows nothing to ask for", () => {
      const partner = player("Partner", ["soy"])
      const game = new Game({ players: [player("Bot", []), partner], deck, phase: "trade", faceUp: new Hand(["green"]) })
      new SimpleBot(game, 0).playTradePhase({ partnerIndexes: [1] })

      expect(partner.pending).toEqual(["green"])
      expect(partner.hand.cards).toEqual(["soy"])
    })

    it("offers the poorest partner first", () => {
      const bot = player("Bot", [], { fields: grown() })
      const rich = player("Rich", [], { coinCards: ["red"] })
      const poor = player("Poor", [])
      const game = new Game({ players: [bot, rich, poor], deck, phase: "trade", faceUp: new Hand(["green"]) })
      new SimpleBot(game, 0).playTradePhase({ partnerIndexes: [1, 2] })

      expect(poor.pending).toEqual(["green"])
      expect(rich.pending).toEqual([])
    })

    it("keeps a card nobody wants", () => {
      const bot = player("Bot", [], { fields: grown() })
      const partner = player("Partner", [], { fields: [new Field({ bean: "red", count: 1 }), new Field({ bean: "wax", count: 1 })] })
      const game = new Game({ players: [bot, partner], deck, phase: "trade", faceUp: new Hand(["green"]) })
      new SimpleBot(game, 0).playTradePhase({ partnerIndexes: [1] })

      expect(bot.pending).toEqual(["green"])
    })
  })

  describe("#plantPending", () => {
    it("plants every pending card", () => {
      const bot = player("Bot", [])
      const game = new Game({ players: [bot, player("Other", [])], deck, phase: "plant_pending" })
      bot.receive(["red", "red", "soy"])
      new SimpleBot(game, 0).plantPending()

      expect(bot.fields.map((field) => field.count)).toEqual([2, 1])
      expect(bot.pending).toEqual([])
    })
  })

  describe("#accepts", () => {
    let game: Game
    let bot: SimpleBot

    beforeEach(() => {
      const fields = [new Field({ bean: "soy", count: 2 }), new Field()]
      game = new Game({ players: [player("Bot", ["soy", "red"], { fields })], deck })
      bot = new SimpleBot(game, 0)
    })

    it("takes cards it can plant", () => {
      expect(bot.accepts({ offered: ["blue"], requested: ["red"] })).toBe(true)
    })

    it("refuses to give away a bean it grows", () => {
      expect(bot.accepts({ offered: ["blue"], requested: ["soy"] })).toBe(false)
    })

    it("needs an empty field for each new bean type", () => {
      expect(bot.accepts({ offered: ["blue", "red"], requested: [] })).toBe(false)
      expect(bot.accepts({ offered: ["blue", "soy"], requested: [] })).toBe(true)
    })

    it("never suggests a smaller deal", () => {
      expect(bot.counterOffer({ offered: ["blue", "red"], requested: ["soy"] })).toBeNull()
    })

    it("refuses cards it has no room for", () => {
      game.players[0]?.plant("red", 1)

      expect(bot.accepts({ offered: ["blue"], requested: [] })).toBe(false)
    })
  })
})
