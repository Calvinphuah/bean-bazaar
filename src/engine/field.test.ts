import { beforeEach, describe, expect, it } from "vitest"
import { Field } from "./field"

describe("Field", () => {
  let field: Field

  beforeEach(() => {
    field = new Field()
  })

  it("starts empty and earns nothing", () => {
    expect(field.isEmpty()).toBe(true)
    expect(field.coins()).toBe(0)
  })

  describe("#plant", () => {
    it("takes any bean when empty, then only that bean", () => {
      field.plant("soy")
      field.plant("soy")

      expect(field.bean).toBe("soy")
      expect(field.count).toBe(2)
      expect(field.accepts("red")).toBe(false)
    })

    it("rejects a different bean", () => {
      field.plant("soy")

      expect(() => field.plant("red")).toThrow("This field already holds soy beans")
    })
  })

  describe("#harvest", () => {
    it("returns every card and empties the field", () => {
      for (let planted = 0; planted < 4; planted++) field.plant("blue")

      expect(field.coins()).toBe(1)
      expect(field.harvest()).toEqual(["blue", "blue", "blue", "blue"])
      expect(field.isEmpty()).toBe(true)
      expect(field.accepts("red")).toBe(true)
    })
  })
})
