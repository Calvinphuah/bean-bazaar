import { beforeEach, describe, expect, it } from "vitest"
import { Deck, Field, Game, Hand, Player } from "../engine"
import type { BeanKey, BotLevel, Move } from "../types"
import { botRunner, engineOf, type SavedGame } from "./games"
import { serializeGame } from "./serializer"
import { createGame, makeMove, quoteTrade } from "./services"

function field(bean: BeanKey | null = null, count = 0): Field {
  return new Field({ bean, count })
}

function player(name: string, hand: BeanKey[], { fields, coinCards = [] }: { fields?: Field[]; coinCards?: BeanKey[] } = {}): Player {
  return new Player({ name, hand: new Hand(hand), fields: fields ?? [field(), field()], coinCards })
}

function savedFrom(engine: Game, botLevel: BotLevel): SavedGame {
  return { id: 1, human_index: 0, bot_level: botLevel, state: engine.toJSON(), undo_states: [] }
}

describe("createGame", () => {
  it("seats the human first against the chosen bots and waits for their move", () => {
    const saved = createGame({ id: 7, botCount: 3, botLevel: "normal", seed: 1 })
    const engine = engineOf(saved)

    expect(engine.players.map((seat) => seat.name)).toEqual(["You", "Pinto", "Lima", "Fava"])
    expect(saved.human_index).toBe(0)
    expect(engine.activeIndex).toBe(0)
    expect(engine.phase).toBe("plant")
  })

  it("plays easy, normal or smart bots", () => {
    expect(createGame({ id: 1, botCount: 2, botLevel: "easy" }).bot_level).toBe("easy")
    expect(createGame({ id: 1, botCount: 2, botLevel: "smart" }).bot_level).toBe("smart")
  })

  it("rejects a bot count outside 2 to 4 or an unknown level", () => {
    expect(() => createGame({ id: 1, botCount: 5, botLevel: "normal" })).toThrow("Choose 2 to 4 bots")
    expect(() => createGame({ id: 1, botCount: Number("lots"), botLevel: "normal" })).toThrow("Choose 2 to 4 bots")
    expect(() => createGame({ id: 1, botCount: 2, botLevel: "genius" })).toThrow("Choose easy, normal or smart bots")
  })
})

describe("makeMove", () => {
  // You hold blue/soy; Pinto grows red and will swap away a spare green; Lima grows wax and soy.
  let you: Player
  let pinto: Player
  let lima: Player
  let deck: Deck
  let saved: SavedGame

  beforeEach(() => {
    you = player("You", ["blue", "soy", "chili"])
    pinto = player("Pinto", ["green", "stink"], { fields: [field("red", 2), field()] })
    lima = player("Lima", ["wax"], { fields: [field("wax", 2), field("soy", 2)] })
    deck = new Deck({ drawPile: ["red", "soy", ...Array<BeanKey>(40).fill("chili")] })
    // Easy bots never make offers, so each turn plays straight through.
    saved = savedFrom(new Game({ players: [you, pinto, lima], deck }), "easy")
  })

  function move(type: string, fields: Record<string, unknown> = {}): SavedGame {
    saved = makeMove(saved, { type, ...fields } as Move)
    return saved
  }

  function engine(): Game {
    return engineOf(saved)
  }

  describe("undo", () => {
    it("takes back plants and harvests one at a time", () => {
      move("plant_from_hand", { field_index: 0 })
      move("harvest", { field_index: 0 })
      expect(saved.undo_states).toHaveLength(2)
      expect(saved.undo_states.flatMap((state) => Object.keys(state))).not.toContain("log")

      move("undo")
      expect(engine().players[0]?.fields[0]?.bean).toBe("blue")
      move("undo")
      expect(engine().players[0]?.hand.cards).toEqual(["blue", "soy", "chili"])
      expect(engine().handPlants).toBe(0)
      // The log is rebuilt from the live one, minus the moves taken back.
      expect(engine().log.map((event) => event.type)).not.toContain("plant")
      expect(engine().log.map((event) => event.type)).not.toContain("harvest")
      expect(saved.undo_states).toEqual([])
    })

    it("wipes the history once cards are flipped", () => {
      move("plant_from_hand", { field_index: 0 })
      move("flip_cards")

      expect(saved.undo_states).toEqual([])
      expect(() => move("undo")).toThrow("There's nothing to undo")
    })

    it("takes back the second plant, which no longer flips the cards for you", () => {
      move("plant_from_hand", { field_index: 0 })
      move("plant_from_hand", { field_index: 1 })
      expect(engine().phase).toBe("plant")

      move("undo")
      expect(engine().handPlants).toBe(1)
    })

    it("won't take back a plant once the cards are flipped", () => {
      move("plant_from_hand", { field_index: 0 })
      move("flip_cards")

      expect(saved.undo_states).toEqual([])
    })
  })

  it("plants from hand and saves the game", () => {
    move("plant_from_hand", { field_index: 0 })

    expect(engine().players[0]?.fields[0]?.bean).toBe("blue")
    expect(engine().handPlants).toBe(1)
  })

  it("flips cards into the trade phase", () => {
    move("plant_from_hand", { field_index: 0 })
    move("flip_cards")

    expect(engine().faceUp.cards).toEqual(["red", "soy"])
  })

  it("leaves the saved game unchanged when a move breaks a rule", () => {
    const before = JSON.stringify(saved)

    expect(() => move("flip_cards")).toThrow("Plant the front card of your hand first")
    expect(JSON.stringify(saved)).toBe(before)
  })

  describe("trading", () => {
    beforeEach(() => {
      // A spare third field leaves room for the face-up red bean.
      you = player("You", ["blue", "soy", "chili"], { fields: [field(), field(), field()] })
      saved = savedFrom(new Game({ players: [you, pinto, lima], deck }), "easy")
      move("plant_from_hand", { field_index: 0 })
      move("plant_from_hand", { field_index: 1 })
      move("flip_cards")
    })

    it("trades with a bot that likes the offer", () => {
      move("trade", { partner_index: 1, face_up_indexes: [0], partner_beans: ["green"] })

      expect(engine().players[1]?.pending).toEqual(["red"])
      expect(engine().players[0]?.pending).toEqual(["green"])
    })

    it("reports a bot turning the offer down", () => {
      expect(() => move("trade", { partner_index: 2, partner_beans: ["wax"] })).toThrow("Lima turned down your offer")
    })

    it("rejects trading with yourself or nobody", () => {
      expect(() => move("trade", { partner_index: 0, hand_indexes: [0] })).toThrow("You can't trade with yourself")
      expect(() => move("trade", { partner_index: 9, hand_indexes: [0] })).toThrow("There is no player 9")
    })

    it("rejects a card that is not there", () => {
      expect(() => move("trade", { partner_index: 1, face_up_indexes: [7] })).toThrow("There is no card at position 7")
    })

    it("rejects asking for a bean the bot doesn't hold", () => {
      expect(() => move("trade", { partner_index: 1, face_up_indexes: [0], partner_beans: ["green", "green"] })).toThrow(
        "Pinto doesn't have those beans to give",
      )
    })

    it("ends trading, plants pending cards, and lets the bots play", () => {
      move("end_trading")
      move("plant_pending", { pending_index: 0, field_index: 2 })

      expect(engine().players[0]?.pending).toEqual(["soy"])

      move("plant_pending", { pending_index: 0, field_index: 1 })

      // Your last plant can still be undone, so the turn waits for you to draw.
      expect(engine().phase).toBe("draw")
      expect(saved.undo_states).not.toEqual([])

      move("draw_cards")

      expect(engine().activeIndex).toBe(0)
      expect(engine().phase).toBe("plant")
    })

    it("draws for you when the bots plant the last traded beans, as there is nothing to undo", () => {
      const waiting = new Game({ players: [you, pinto, lima], deck, phase: "trade", faceUp: new Hand([]) })
      waiting.players[1]?.pending.push("red")
      saved = savedFrom(waiting, "easy")
      const handBefore = you.hand.size

      move("end_trading")

      expect(engine().activeIndex).toBe(0)
      expect(engine().phase).toBe("plant")
      expect(engine().players[0]?.hand.size).toBe(handBefore + 3)
    })
  })

  describe("answering a smart bot's offer", () => {
    beforeEach(() => {
      // Pinto grows soy and blue, so it offers its useless face-up red for either, blue first.
      pinto = player("Pinto", [], { fields: [field("soy", 2), field("blue", 3)] })
      you = player("You", ["blue", "chili"])
      const offered = new Game({ players: [you, pinto, lima], deck, activeIndex: 1, phase: "trade", faceUp: new Hand(["red"]) })
      saved = savedFrom(offered, "smart")
      botRunner(saved, offered).run()
      saved = { ...saved, state: offered.toJSON() }
    })

    it("shows the waiting offer, and only to you", () => {
      expect(engine().offer).toMatchObject({ partner_index: 0, choices: ["blue", "soy"] })
      expect(serializeGame(saved, engine()).offer).toEqual({ from: 1, give: ["red"], ask: [], choices: ["blue", "soy"] })
    })

    it("accepts the offer with the bean you pick and lets the bots carry on", () => {
      move("accept_offer", { bean: "blue" })

      expect(engine().offer).toBeNull()
      expect(engine().players[0]?.pending).toEqual(["red"])
      expect(engine().players[0]?.hand.cards).toEqual(["chili"])
    })

    it("lets you make your own offer instead, then the bots carry on", () => {
      move("open_bids")
      expect(engine().bidding).toBe(0)

      expect(() => move("bid", { hand_indexes: [1], face_up_indexes: [0] })).toThrow("Pinto turned down your offer")
      move("bid", { hand_indexes: [0], face_up_indexes: [0] })
      expect(engine().players[0]?.pending).toEqual(["red"])

      move("close_bids")
      expect(engine().bidding).toBeNull()
    })

    it("declines the offer and keeps your cards", () => {
      move("decline_offer")

      expect(engine().log.map((event) => event.text)).toContain("You turned down Pinto's offer")
      expect(engine().players[0]?.hand.cards.slice(0, 2)).toEqual(["blue", "chili"])
    })
  })

  it("rejects answering when no offer waits", () => {
    expect(() => move("accept_offer")).toThrow("There is no offer waiting for you")
  })

  it("rejects bids before you have opened bidding on a bot's deal", () => {
    expect(() => move("bid", { face_up_indexes: [0] })).toThrow("Make your own offer from a bot's deal first")
  })

  it("harvests and buys a third field for the human at any time", () => {
    you.plant("soy", 1)
    you.plant("soy", 1)
    you.coinCards.push("red", "red", "red")
    saved = savedFrom(new Game({ players: [you, pinto, lima], deck }), "easy")

    move("harvest", { field_index: 1 })
    move("buy_third_field")

    expect(engine().players[0]?.coins).toBe(1)
    expect(engine().players[0]?.fields).toHaveLength(3)
  })

  it("blocks active-player moves on a bot's turn", () => {
    saved = savedFrom(new Game({ players: [you, pinto, lima], deck, activeIndex: 1 }), "easy")

    expect(() => move("flip_cards")).toThrow("Wait for your turn")
  })

  it("rejects unknown moves and bad numbers", () => {
    expect(() => move("cheat")).toThrow("Unknown move: cheat")
    expect(() => move("plant_from_hand", { field_index: "left" })).toThrow("field_index must be a number")
    expect(() => move("trade", { partner_index: 1, hand_indexes: ["x"] })).toThrow("hand_indexes must be a list of numbers")
  })
})

describe("quoteTrade", () => {
  // Pinto grows red and holds a spare green; Lima grows wax and soy and holds two wax.
  let pinto: Player
  let lima: Player

  beforeEach(() => {
    pinto = player("Pinto", ["green", "stink"], { fields: [field("red", 2), field()] })
    lima = player("Lima", ["wax", "wax"], { fields: [field("wax", 2), field("soy", 3)] })
  })

  function tradeGame(options: { you?: Player; activeIndex?: number; bidding?: number | null; phase?: "trade" | "plant" } = {}): SavedGame {
    const engine = new Game({
      players: [options.you ?? player("You", ["blue", "soy"]), pinto, lima],
      deck: new Deck({ drawPile: Array<BeanKey>(20).fill("chili") }),
      phase: options.phase ?? "trade",
      activeIndex: options.activeIndex ?? 0,
      faceUp: new Hand(["red", "soy"]),
      bidding: options.bidding ?? null,
    })
    return savedFrom(engine, "smart")
  }

  function answers(saved: SavedGame, quote: { face_up_indexes?: number[]; hand_indexes?: number[]; partner_beans?: BeanKey[] }) {
    const picks = { face_up_indexes: [], hand_indexes: [], partner_beans: [], ...quote }
    return Object.fromEntries(quoteTrade(saved, picks).map((entry) => [entry.player, entry.answer]))
  }

  it("asks every bot without trading anything", () => {
    const saved = tradeGame()
    const before = JSON.stringify(saved)

    expect(answers(saved, { face_up_indexes: [0], partner_beans: ["green"] })).toEqual({ 1: "accept", 2: "missing" })
    expect(JSON.stringify(saved)).toBe(before)
  })

  it("reports a bot that would rather keep its beans", () => {
    expect(answers(tradeGame(), { hand_indexes: [0], partner_beans: ["wax"] })).toEqual({ 1: "missing", 2: "decline" })
  })

  it("quotes a gift to every bot, each judging it for itself", () => {
    // Shrewd Lima takes the soy that reaches its next coin; Pinto keeps its one empty
    // field for the green it plants next.
    expect(answers(tradeGame(), { face_up_indexes: [1] })).toEqual({ 1: "decline", 2: "accept" })
  })

  it("passes on the smaller deal a declining bot would take instead", () => {
    // Two soy aren't worth both of Lima's wax, but they are worth one.
    const result = quoteTrade(tradeGame(), { face_up_indexes: [1], hand_indexes: [1], partner_beans: ["wax", "wax"] })

    expect(result).toContainEqual({ player: 2, answer: "decline", counter: { give: ["soy", "soy"], ask: ["wax"] } })
  })

  it("asks only the active bot while you bid, judging your hand cards for its cards", () => {
    // Pinto is trading its flipped red and soy; you made your own offer instead of its deal.
    const saved = tradeGame({ you: player("You", ["red", "blue"]), activeIndex: 1, bidding: 0 })

    // Your red grows Pinto's red field; its own red it keeps.
    expect(answers(saved, { hand_indexes: [0], face_up_indexes: [1] })).toEqual({ 1: "accept" })
    expect(answers(saved, { hand_indexes: [1], face_up_indexes: [0] })).toEqual({ 1: "decline" })
    expect(answers(saved, { hand_indexes: [0], partner_beans: ["wax"] })).toEqual({ 1: "missing" })
  })

  it("only quotes during the human's trade phase", () => {
    expect(() => answers(tradeGame({ phase: "plant" }), { face_up_indexes: [0] })).toThrow("Wait for your turn")
  })

  it("rejects bad card positions", () => {
    expect(() => answers(tradeGame(), { face_up_indexes: [9] })).toThrow("There is no card at position 9")
    expect(() => answers(tradeGame(), { hand_indexes: ["x" as unknown as number] })).toThrow("hand_indexes must be a list of numbers")
  })
})

describe("serializeGame", () => {
  it("shows your hand only, with each field's coins", () => {
    const saved = createGame({ id: 3, botCount: 2, botLevel: "easy", seed: 4 })
    const state = serializeGame(saved, engineOf(saved))

    expect(state.players[0]?.hand).toHaveLength(state.players[0]?.hand_size ?? -1)
    expect(state.players.slice(1).map((seat) => seat.hand)).toEqual([null, null])
    expect(state.players[0]?.fields[0]).toHaveProperty("coins")
    expect(state).toMatchObject({ id: 3, you: 0, bot_level: "easy", can_undo: false, offer: null, bidding: false, over: false, winners: [] })
  })
})
