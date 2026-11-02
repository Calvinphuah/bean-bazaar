import { describe, expect, it } from "vitest"
import { BeanType } from "./beanType"
import { tally } from "./collections"
import { Deck } from "./deck"
import { seededRandom } from "./random"

describe("Deck", () => {
  describe(".shuffled", () => {
    it("holds the full deck in a repeatable order for a seed", () => {
      const deck = Deck.shuffled({ playerCount: 3, random: seededRandom(1) })
      const sameSeed = Deck.shuffled({ playerCount: 3, random: seededRandom(1) })

      expect(tally(deck.drawPile)).toEqual(tally(BeanType.fullDeck(3)))
      expect(deck.drawPile).toEqual(sameSeed.drawPile)
      expect(deck.drawPile).not.toEqual(BeanType.fullDeck(3))
    })
  })

  describe("#draw", () => {
    it("takes cards from the top", () => {
      const deck = new Deck({ drawPile: ["blue", "soy", "red"] })

      expect(deck.draw(2)).toEqual(["blue", "soy"])
      expect(deck.drawPile).toEqual(["red"])
    })

    it("shuffles the discards back in when the pile runs dry", () => {
      const deck = new Deck({ drawPile: ["blue"], discardPile: ["soy"] })

      expect(deck.draw(2)).toEqual(["blue", "soy"])
      expect(deck.runOuts).toBe(1)
      expect(deck.discardPile).toEqual([])
    })

    it("stops on the third run-out", () => {
      const deck = new Deck({ drawPile: ["blue"], discardPile: ["soy"], runOuts: 2 })

      expect(deck.draw(3)).toEqual(["blue"])
      expect(deck.isExhausted()).toBe(true)
      expect(deck.draw(1)).toEqual([])
    })
  })

  describe("#summary", () => {
    it("shows the pile sizes and only the top of the discard pile", () => {
      const deck = new Deck({ drawPile: ["blue"], discardPile: ["soy", "red", "wax", "chili"], runOuts: 1 })

      expect(deck.summary()).toEqual({ draw: 1, discard: 4, discard_top: ["red", "wax", "chili"], run_outs: 1 })
    })
  })

  describe("#discard", () => {
    it("adds cards to the discard pile", () => {
      const deck = new Deck({ drawPile: [] })
      deck.discard(["red", "red"])

      expect(deck.discardPile).toEqual(["red", "red"])
    })
  })
})
