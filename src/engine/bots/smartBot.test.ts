import { beforeEach, describe, expect, it } from "vitest"
import type { BeanKey } from "../../types"
import { BotRunner } from "../botRunner"
import { Deck } from "../deck"
import { Field } from "../field"
import { Game, type DeclinedOffer } from "../game"
import { Hand } from "../hand"
import { Player } from "../player"
import { seededRandom } from "../random"
import type { Bot } from "./bot"
import { SimpleBot } from "./simpleBot"
import { SmartBot } from "./smartBot"

function field(bean: BeanKey | null = null, count = 0): Field {
  return new Field({ bean, count })
}

function player(name: string, hand: BeanKey[], { fields, coinCards = [] }: { fields?: Field[]; coinCards?: BeanKey[] } = {}): Player {
  return new Player({ name, hand: new Hand(hand), fields: fields ?? [field(), field()], coinCards })
}

type GameOptions = Omit<ConstructorParameters<typeof Game>[0], "players" | "deck">

function gameWith(players: Player[], options: GameOptions = {}): Game {
  return new Game({ players, deck: new Deck({ drawPile: Array<BeanKey>(30).fill("chili") }), ...options })
}

describe("SmartBot", () => {
  describe("#playPlantPhase", () => {
    it("keeps a field growing when the same bean is coming up in its hand", () => {
      const bot = player("Bot", ["wax", "soy", "soy"], { fields: [field("soy", 3), field("red", 2)] })
      const game = gameWith([bot, player("Other", [])])
      new SmartBot(game, 0).playPlantPhase()

      expect(bot.fields.map((planted) => planted.bean)).toEqual(["soy", "wax"])
      expect(bot.coins).toBe(1)
    })

    it("sells a field that has reached its top payout", () => {
      const bot = player("Bot", ["soy"], { fields: [field("soy", 6), field("wax", 3)] })
      const game = gameWith([bot, player("Other", [])])
      new SmartBot(game, 0).playPlantPhase()

      expect(bot.fields.slice(-1)[0]?.isEmpty()).toBe(true)
      expect(bot.coins).toBe(4 + 3)
    })

    it("leaves an empty field free for a different bean coming soon", () => {
      const bot = player("Bot", ["soy", "wax", "red"])
      const game = gameWith([bot, player("Other", [])])
      new SmartBot(game, 0).playPlantPhase()

      expect(bot.fields.map((planted) => planted.bean)).toEqual(["soy", null])
    })

    it("flips straight away with an empty hand", () => {
      const game = gameWith([player("Bot", []), player("Other", [])])
      new SmartBot(game, 0).playPlantPhase()

      expect(game.phase).toBe("trade")
    })

    it("plants a second card that joins a field it grows", () => {
      const bot = player("Bot", ["soy", "soy"])
      const game = gameWith([bot, player("Other", [])])
      new SmartBot(game, 0).playPlantPhase()

      expect(bot.fields[0]?.count).toBe(2)
    })

    it("buys a third field early but not in the last reshuffle", () => {
      const rich = player("Bot", ["soy"], { coinCards: ["red", "red", "red"] })
      new SmartBot(gameWith([rich, player("Other", [])]), 0).playPlantPhase()

      const late = player("Late", ["soy"], { coinCards: ["red", "red", "red"] })
      const lateDeck = new Deck({ drawPile: Array<BeanKey>(5).fill("chili"), runOuts: 2 })
      new SmartBot(new Game({ players: [late, player("Other", [])], deck: lateDeck }), 0).playPlantPhase()

      expect(rich.fields).toHaveLength(3)
      expect(late.fields).toHaveLength(2)
    })
  })

  describe("#playTradePhase", () => {
    let bot: Player
    let human: Player

    beforeEach(() => {
      bot = player("Bot", ["green"], { fields: [field("soy", 2), field("blue", 3)] })
      human = player("You", ["soy"])
    })

    it("offers the human a card it cannot use for any bean it grows, the one it needs most first", () => {
      const game = gameWith([bot, human], { phase: "trade", faceUp: new Hand(["red", "blue"]) })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      // Blue at 3 is one bean from its next coin; soy at 2 is two away.
      expect(game.offer).toEqual({ partner_index: 1, face_up_indexes: [0], hand_indexes: [], partner_beans: [], choices: ["blue", "soy"] })
      expect(game.phase).toBe("trade")
    })

    it("skips a bean the human has said they hold none of", () => {
      const game = gameWith([bot, human], { phase: "trade", faceUp: new Hand(["red", "blue"]), lacking: [[], ["blue"]] })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer?.choices).toEqual(["soy"])
    })

    it("gives a hand card it has no field for to a bot that has more of it coming", () => {
      const crowded = player("Bot", ["soy", "red"], { fields: [field("soy", 3), field("wax", 2)] })
      const taker = player("Taker", ["red"])
      const game = gameWith([crowded, taker], { phase: "trade" })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [1] })

      expect(crowded.hand.cards).toEqual(["soy"])
      expect(taker.pending).toEqual(["red"])
    })

    it("offers the human first, before sharing cards out to the bots", () => {
      const taker = player("Taker", ["red"])
      const game = gameWith([bot, human, taker], { phase: "trade", faceUp: new Hand(["red", "blue"]) })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [2], humanIndex: 1 })

      expect(game.offer).toMatchObject({ partner_index: 1, face_up_indexes: [0] })
      expect(taker.pending).toEqual([])
    })

    it("offers a loose hand card when every face-up card is useful", () => {
      const game = gameWith([bot, human], { phase: "trade", faceUp: new Hand(["blue"]) })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer?.hand_indexes).toEqual([0])
    })

    it("makes at most three offers to the human per turn, then ends trading", () => {
      const game = gameWith([bot, human], { phase: "trade", faceUp: new Hand(["red"]), offersThisTurn: 3 })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer).toBeNull()
      expect(game.phase).toBe("plant_pending")
    })

    it("ends trading when it has nothing to offer", () => {
      const useful = player("Bot", [], { fields: [field("soy", 2), field("blue", 3)] })
      const game = gameWith([useful, human], { phase: "trade", faceUp: new Hand(["blue"]) })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer).toBeNull()
    })

    it("gifts the poorest player first, the human included, after a turned-down offer", () => {
      const taker = player("Taker", ["red"])
      const declined: DeclinedOffer[] = [
        { partner_index: 1, gives: ["red"], partner_beans: [], choices: ["blue", "soy"] },
        { partner_index: 1, gives: ["red"], partner_beans: [], choices: [] },
      ]
      const game = gameWith([bot, human, taker], { phase: "trade", faceUp: new Hand(["red", "wax"]), declined })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [2], humanIndex: 1 })

      // The human turned the red bean down, so the taker gets it and the human is offered the wax.
      expect(taker.pending).toEqual(["red"])
      expect(game.offer).toMatchObject({ partner_index: 1, face_up_indexes: [0], choices: [] })
      expect(game.faceUp.cards).toEqual(["wax"])
    })

    it("gives to a poorer bot before a richer human", () => {
      const rich = player("You", ["soy"], { coinCards: ["red"] })
      const taker = player("Taker", ["red"])
      const game = gameWith([bot, rich, taker], { phase: "trade", faceUp: new Hand(["red"]), offersThisTurn: 3 })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [2], humanIndex: 1 })

      expect(taker.pending).toEqual(["red"])
      expect(game.offer).toBeNull()
    })

    it("keeps a flipped card it can start a free field with", () => {
      const fresh = player("Bot", ["wax"])
      const game = gameWith([fresh, human], { phase: "trade", faceUp: new Hand(["blue"]) })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer).toBeNull()
      expect(fresh.pending).toEqual(["blue"])
    })

    it("gifts a flipped card when the human lacks every bean it grows", () => {
      const game = gameWith([bot, human], { phase: "trade", faceUp: new Hand(["red"]), lacking: [[], ["soy", "blue"]] })
      new SmartBot(game, 0).playTradePhase({ partnerIndexes: [], humanIndex: 1 })

      expect(game.offer).toMatchObject({ face_up_indexes: [0], choices: [] })
    })
  })

  describe("#accepts", () => {
    let bot: Player
    let smart: SmartBot

    beforeEach(() => {
      bot = player("Bot", ["soy", "wax"], { fields: [field("soy", 3), field()] })
      smart = new SmartBot(gameWith([bot, player("Other", [])]), 0)
    })

    function judge(hand: BeanKey[], fields: Field[], deal: { offered: BeanKey[]; requested: BeanKey[] }): boolean {
      return new SmartBot(gameWith([player("Bot", hand, { fields }), player("Other", [])]), 0).accepts(deal)
    }

    it("takes a bean that reaches its next coin", () => {
      expect(smart.accepts({ offered: ["soy"], requested: ["wax"] })).toBe(true)
    })

    it("gives up a loose card for a free one", () => {
      bot.plant("red", 1)

      expect(smart.accepts({ offered: ["soy"], requested: ["wax"] })).toBe(true)
    })

    it("refuses to hand over a bean it grows for one it cannot use", () => {
      bot.plant("red", 1)

      expect(smart.accepts({ offered: ["blue"], requested: ["soy"] })).toBe(false)
    })

    it("keeps its empty field for the card it must plant next", () => {
      expect(judge(["wax", "soy"], [field("soy", 3), field()], { offered: ["blue"], requested: [] })).toBe(false)
    })

    it("turns down a lone junk bean even with a field free", () => {
      expect(judge(["soy"], [field("soy", 3), field()], { offered: ["blue"], requested: [] })).toBe(false)
    })

    it("takes a gift for a free field when more of that bean is coming in its hand", () => {
      expect(judge(["soy", "blue"], [field("soy", 3), field()], { offered: ["blue"], requested: [] })).toBe(true)
    })

    it("judges a bid by the bidder, not by itself as the active player", () => {
      const active = player("Bot", ["soy", "wax"], { fields: [field("soy", 3), field()] })
      const leader = player("Leader", [], { coinCards: ["red", "red", "red"] })
      const game = gameWith([active, leader], { phase: "trade", bidding: 1 })

      expect(new SmartBot(game, 0).accepts({ offered: ["soy"], requested: ["soy"] })).toBe(false)
      const level = gameWith([active, player("Level", [])], { phase: "trade", bidding: 1 })
      expect(new SmartBot(level, 0).accepts({ offered: ["soy"], requested: ["soy"] })).toBe(true)
    })

    it("asks more of a leader before helping them", () => {
      const asked = player("Bot", ["soy", "wax"], { fields: [field("soy", 3), field()] })
      const level = new SmartBot(gameWith([player("Asker", []), asked]), 1)
      const leader = new SmartBot(gameWith([player("Asker", [], { coinCards: ["red", "red", "red"] }), asked]), 1)

      expect(level.accepts({ offered: ["soy"], requested: ["soy"] })).toBe(true)
      expect(leader.accepts({ offered: ["soy"], requested: ["soy"] })).toBe(false)
    })

    it("turns down a pile of different beans it would have to dig up fields for", () => {
      expect(judge(["soy"], [field("soy", 3), field()], { offered: ["blue", "red", "wax"], requested: [] })).toBe(false)
    })

    it("never takes more new bean types than it has fields to put them in", () => {
      const generous = ["blue", "blue", "blue", "blue", "wax", "chili"]

      expect(judge(["soy"], [field("soy", 3), field("red", 2)], { offered: generous, requested: [] })).toBe(false)
    })

    it("wants something back for a card the asker needs", () => {
      expect(smart.accepts({ offered: [], requested: ["wax"] })).toBe(false)
    })
  })

  describe("#counterOffer", () => {
    let bot: Player
    let smart: SmartBot

    beforeEach(() => {
      bot = player("Bot", ["soy", "wax"], { fields: [field("soy", 3), field()] })
      smart = new SmartBot(gameWith([bot, player("Other", [])]), 0)
    })

    it("keeps the bean it grows out of the deal and still trades the rest", () => {
      expect(smart.accepts({ offered: ["soy"], requested: ["wax", "soy"] })).toBe(false)
      expect(smart.counterOffer({ offered: ["soy"], requested: ["wax", "soy"] })).toEqual({ offered: ["soy"], requested: ["wax"] })
    })

    it('never counters with just "give me your card" when the asker wanted beans', () => {
      const leader = new SmartBot(gameWith([player("Asker", [], { coinCards: ["red", "red", "red"] }), bot]), 1)

      expect(leader.counterOffer({ offered: ["soy"], requested: ["soy"] })).toBeNull()
    })

    it("has no counter when no smaller deal is any good", () => {
      expect(smart.counterOffer({ offered: [], requested: ["soy"] })).toBeNull()
    })
  })

  describe("#plantPending", () => {
    it("plants the fitting cards first, then makes room for the rest", () => {
      const bot = player("Bot", [], { fields: [field("soy", 2), field("red", 2)] })
      const game = gameWith([bot, player("Other", [])], { phase: "plant_pending" })
      bot.receive(["wax", "soy"])
      new SmartBot(game, 0).plantPending()

      expect(bot.fields.map((planted) => planted.bean)).toEqual(["soy", "wax"])
      expect(bot.pending).toEqual([])
    })
  })

  // Against two easy bots a fair share is one game in three; it should win clearly more.
  // It wins about 40%, so 300 games keep the bar clear of seed luck.
  it("beats the easy bots over many games", () => {
    // Seat 0 plays smart, the others play easy.
    class MixedRunner extends BotRunner {
      constructor(private readonly table: Game) {
        super(table, { humanIndex: null })
      }

      bot(index: number): Bot {
        return index === 0 ? new SmartBot(this.table, index) : new SimpleBot(this.table, index)
      }
    }

    const games = 300
    let wins = 0
    for (let seed = 0; seed < games; seed++) {
      const game = Game.start({ names: ["Smart", "Easy1", "Easy2"], random: seededRandom(seed) })
      new MixedRunner(game).run()
      if (game.winners().includes(game.players[0] as Player)) wins += 1
    }

    expect(wins).toBeGreaterThanOrEqual(games * 0.36)
  })
})
