import { beforeEach, describe, expect, it } from "vitest"
import { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"

describe("Hand", () => {
  let hand: Hand

  beforeEach(() => {
    hand = new Hand(["blue", "soy", "red"])
  })

  it("adds new cards to the back", () => {
    hand.add(["wax"])

    expect(hand.cards).toEqual(["blue", "soy", "red", "wax"])
  })

  it("plants from the front", () => {
    expect(hand.front()).toBe("blue")
    expect(hand.takeFront()).toBe("blue")
    expect(hand.cards).toEqual(["soy", "red"])
  })

  it("takes every card", () => {
    expect(hand.takeAll()).toEqual(["blue", "soy", "red"])
    expect(hand.isEmpty()).toBe(true)
  })

  describe("#takeAt", () => {
    it("removes the picked cards and keeps the rest in order", () => {
      expect(hand.takeAt([2, 0])).toEqual(["blue", "red"])
      expect(hand.cards).toEqual(["soy"])
      expect(hand.size).toBe(1)
    })

    it("rejects a card picked twice", () => {
      expect(() => hand.takeAt([1, 1])).toThrow(new IllegalMove("Pick each card only once"))
    })

    it("rejects a position with no card", () => {
      expect(() => hand.takeAt([3])).toThrow(new IllegalMove("There is no card at position 3"))
      expect(hand.cards).toEqual(["blue", "soy", "red"])
    })
  })

  describe("#indexesOf", () => {
    it("finds each asked-for bean once, or null when one is missing", () => {
      const row = new Hand(["soy", "red", "soy"])

      expect(row.indexesOf(["soy", "soy"])).toEqual([0, 2])
      expect(row.indexesOf(["soy", "soy", "soy"])).toBeNull()
    })
  })
})
