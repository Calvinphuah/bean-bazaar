import { beforeEach, describe, expect, it } from "vitest"
import type { BeanKey } from "../types"
import { Field } from "./field"
import { Player } from "./player"

function fieldWith(bean: BeanKey, count: number): Field {
  return new Field({ bean, count })
}

describe("Player", () => {
  let player: Player

  beforeEach(() => {
    player = new Player({ name: "Calvin" })
  })

  it("starts with two empty fields and no coins", () => {
    expect(player.fields).toHaveLength(2)
    expect(player.coins).toBe(0)
  })

  it("rejects a field that doesn't exist", () => {
    expect(() => player.plant("soy", 2)).toThrow("There is no field 2")
  })

  describe("#harvest", () => {
    it("keeps coin cards and returns the rest for the discard pile", () => {
      player = new Player({ name: "Calvin", fields: [fieldWith("blue", 6), fieldWith("soy", 1)] })

      expect(player.harvest(0)).toEqual(["blue", "blue", "blue", "blue"])
      expect(player.coins).toBe(2)
      expect(player.fields[0]?.isEmpty()).toBe(true)
    })

    it("rejects an empty field", () => {
      expect(() => player.harvest(0)).toThrow("That field is empty")
    })

    it("protects a lone bean while another field has more than one", () => {
      player = new Player({ name: "Calvin", fields: [fieldWith("soy", 1), fieldWith("red", 2)] })

      expect(() => player.harvest(0)).toThrow("Harvest a field with more beans first")
    })

    it("allows a lone bean when every field has at most one", () => {
      player = new Player({ name: "Calvin", fields: [fieldWith("soy", 1), fieldWith("red", 1)] })

      expect(player.harvest(0)).toEqual(["soy"])
    })
  })

  describe("#harvestAll", () => {
    it("harvests every field, ignoring the lone-bean rule", () => {
      player = new Player({ name: "Calvin", fields: [fieldWith("soy", 1), fieldWith("red", 3)] })

      expect(player.harvestAll()).toEqual(["soy", "red"])
      expect(player.coins).toBe(2)
      expect(player.fields.every((field) => field.isEmpty())).toBe(true)
    })
  })

  describe("#plantPending", () => {
    it("plants a pending card and removes it from pending", () => {
      player.receive(["red", "soy"])
      player.plantPending(1, 0)

      expect(player.pending).toEqual(["red"])
      expect(player.fields[0]?.bean).toBe("soy")
    })

    it("rejects a pending position with no card", () => {
      expect(() => player.plantPending(0, 0)).toThrow("There is no card at position 0")
    })
  })

  describe("#buyThirdField", () => {
    it("spends 3 coins for a third field", () => {
      player = new Player({ name: "Calvin", coinCards: ["blue", "soy", "red", "wax"] })

      expect(player.buyThirdField()).toEqual(["soy", "red", "wax"])
      expect(player.fields).toHaveLength(3)
      expect(player.coins).toBe(1)
    })

    it("needs 3 coins", () => {
      player = new Player({ name: "Calvin", coinCards: ["blue", "soy"] })

      expect(() => player.buyThirdField()).toThrow("A third field costs 3 coins")
    })

    it("allows only one extra field", () => {
      player = new Player({ name: "Calvin", coinCards: Array<BeanKey>(6).fill("blue") })
      player.buyThirdField()

      expect(() => player.buyThirdField()).toThrow("You already have 3 fields")
    })
  })
})
