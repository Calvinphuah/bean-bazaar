import { describe, expect, it } from "vitest"
import type { BeanKey } from "../../types"
import { Deck } from "../deck"
import { Field } from "../field"
import { Game } from "../game"
import { Hand } from "../hand"
import { Player } from "../player"
import { PLAIN, personalityFor } from "./personality"
import { SmartBot } from "./smartBot"

function field(bean: BeanKey | null = null, count = 0): Field {
  return new Field({ bean, count })
}

// Fresh fields each call, since a bot's fields are its own.
function smart(name: string, hand: BeanKey[], fields: () => Field[]): SmartBot {
  const bot = new Player({ name, hand: new Hand(hand), fields: fields() })
  const game = new Game({ players: [new Player({ name: "Asker" }), bot], deck: new Deck({ drawPile: [] }) })
  return new SmartBot(game, 1)
}

// Each named Smart bot leans one way; a bot with another name plays it straight.
describe("Personality", () => {
  it("plays a bot with no personality straight", () => {
    expect(personalityFor("Bot")).toBe(PLAIN)
  })

  it("makes Pinto take a lone gift a plain bot turns down", () => {
    const fields = () => [field("soy", 3), field()]

    expect(smart("Pinto", ["soy"], fields).accepts({ offered: ["blue"], requested: [] })).toBe(true)
    expect(smart("Bot", ["soy"], fields).accepts({ offered: ["blue"], requested: [] })).toBe(false)
  })

  it("makes Lima charge a leader more", () => {
    const judge = (name: string) => {
      const leader = new Player({ name: "Leader", coinCards: ["red"] })
      const bot = new Player({ name, hand: new Hand(["soy"]), fields: [field("soy", 3), field()] })
      const game = new Game({ players: [leader, bot], deck: new Deck({ drawPile: [] }) })
      return new SmartBot(game, 1).accepts({ offered: ["soy"], requested: ["wax", "wax"] })
    }

    expect(judge("Lima")).toBe(false)
    expect(judge("Bot")).toBe(true)
  })

  it("makes Fava guard the bean of its biggest field", () => {
    const fields = () => [field("soy", 3), field("blue", 1)]

    expect(smart("Fava", ["soy"], fields).accepts({ offered: ["blue", "blue", "blue"], requested: ["soy"] })).toBe(false)
    expect(smart("Bot", ["soy"], fields).accepts({ offered: ["blue", "blue", "blue"], requested: ["soy"] })).toBe(true)
  })

  it("makes Mung dig up a field to chase a new bean", () => {
    const fields = () => [field("blue", 2), field("green", 2)]

    expect(smart("Mung", [], fields).accepts({ offered: ["red", "red"], requested: [] })).toBe(true)
    expect(smart("Bot", [], fields).accepts({ offered: ["red", "red"], requested: [] })).toBe(false)
  })
})
