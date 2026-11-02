import { describe, expect, it } from "vitest"
import { BeanType } from "./beanType"
import { count } from "./collections"

describe("BeanType", () => {
  describe(".all", () => {
    it("has 10 beans totalling 130 cards", () => {
      expect(BeanType.all.map((beanType) => beanType.key)).toEqual(["coffee", "blue", "chili", "stink", "green", "soy", "black_eyed", "red", "wax", "golden"])
      expect(BeanType.all.reduce((sum, beanType) => sum + beanType.copies, 0)).toBe(130)
    })
  })

  describe(".find", () => {
    it("returns the bean type for a key", () => {
      expect(BeanType.find("soy").name).toBe("Soy")
    })

    it("throws for an unknown key", () => {
      expect(() => BeanType.find("cocoa")).toThrow("Unknown bean: cocoa")
    })
  })

  describe(".fullDeck", () => {
    it("has one card per copy, adding Coffee and Golden only for 5 players", () => {
      const small = BeanType.fullDeck(4)
      const big = BeanType.fullDeck(5)

      expect(small).toHaveLength(104)
      expect(small).not.toContain("coffee")
      expect(small).not.toContain("golden")
      expect(big).toHaveLength(130)
      expect(count(big, "coffee")).toBe(22)
      expect(count(big, "golden")).toBe(4)
    })
  })

  describe("#coinsFor", () => {
    const blue = BeanType.find("blue")

    it("pays nothing below the first step", () => {
      expect(blue.coinsFor(3)).toBe(0)
    })

    it("pays the highest step reached", () => {
      expect(blue.coinsFor(4)).toBe(1)
      expect(blue.coinsFor(7)).toBe(2)
      expect(blue.coinsFor(15)).toBe(4)
    })

    it("skips missing steps for rare beans", () => {
      const wax = BeanType.find("wax")

      expect(wax.coinsFor(1)).toBe(0)
      expect(wax.coinsFor(2)).toBe(2)
      expect(wax.coinsFor(6)).toBe(3)
    })

    it("never pays a single coin for the golden bean", () => {
      const golden = BeanType.find("golden")

      expect([1, 2, 3, 4].map((beanCount) => golden.coinsFor(beanCount))).toEqual([0, 2, 3, 4])
    })
  })
})
