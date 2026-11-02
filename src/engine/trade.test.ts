import { beforeEach, describe, expect, it } from "vitest"
import { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"
import { Player } from "./player"
import { Trade } from "./trade"

describe("Trade", () => {
  let active: Player
  let partner: Player
  let faceUp: Hand

  beforeEach(() => {
    active = new Player({ name: "Calvin", hand: new Hand(["blue", "soy"]) })
    partner = new Player({ name: "Bot", hand: new Hand(["red", "wax"]) })
    faceUp = new Hand(["chili", "green"])
  })

  function trade(indexes: { faceUpIndexes?: number[]; handIndexes?: number[]; partnerHandIndexes?: number[] } = {}): Trade {
    return new Trade({ active, partner, faceUp, ...indexes })
  }

  it("swaps face-up and hand cards into each other's pending cards", () => {
    trade({ faceUpIndexes: [1], handIndexes: [0], partnerHandIndexes: [1] }).execute()

    expect(partner.pending).toEqual(["green", "blue"])
    expect(active.pending).toEqual(["wax"])
    expect(faceUp.cards).toEqual(["chili"])
    expect(active.hand.cards).toEqual(["soy"])
    expect(partner.hand.cards).toEqual(["red"])
  })

  it("allows a gift", () => {
    trade({ faceUpIndexes: [0] }).execute()

    expect(partner.pending).toEqual(["chili"])
    expect(active.pending).toEqual([])
  })

  it("rejects an empty trade", () => {
    expect(() => trade().execute()).toThrow("A trade needs at least one card")
  })

  it("rejects trading with yourself", () => {
    const selfTrade = new Trade({ active, partner: active, faceUp, handIndexes: [0] })

    expect(() => selfTrade.execute()).toThrow("You can't trade with yourself")
  })

  it("changes nothing when one side is invalid", () => {
    expect(() => trade({ handIndexes: [0], partnerHandIndexes: [5] }).execute()).toThrow(IllegalMove)

    expect(active.hand.cards).toEqual(["blue", "soy"])
    expect(partner.pending).toEqual([])
  })
})
