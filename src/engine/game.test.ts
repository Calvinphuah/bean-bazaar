import { beforeEach, describe, expect, it } from "vitest"
import type { BeanKey, LogEvent } from "../types"
import { Deck } from "./deck"
import { Game } from "./game"
import { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"
import { Player } from "./player"
import { seededRandom } from "./random"

function player(name: string, hand: BeanKey[]): Player {
  return new Player({ name, hand: new Hand(hand) })
}

function texts(game: Game): string[] {
  return game.log.map((entry) => entry.text)
}

function roundTrip(game: Game): Game {
  return Game.fromJSON(JSON.parse(JSON.stringify(game.toJSON())))
}

describe("Game", () => {
  let calvin: Player
  let bot: Player
  let deck: Deck
  let game: Game

  beforeEach(() => {
    calvin = player("Calvin", ["blue", "soy", "red"])
    bot = player("Bot", ["wax", "chili"])
    deck = new Deck({ drawPile: ["green", "stink", "red", "red", "red", "black_eyed"] })
    game = new Game({ players: [calvin, bot], deck })
  })

  describe(".start", () => {
    it("deals 5 cards to each of 3 to 5 players", () => {
      const started = Game.start({ names: ["Calvin", "Bot1", "Bot2", "Bot3"], random: seededRandom(1) })

      expect(started.players.map((seat) => seat.hand.size)).toEqual([5, 5, 5, 5])
      expect(started.deck.drawPile).toHaveLength(104 - 20)
      expect(started.phase).toBe("plant")
      expect(started.activePlayer.name).toBe("Calvin")
    })

    it("lists the beans for its player count, plus any already in its cards", () => {
      const small = Game.start({ names: ["Calvin", "Bot1", "Bot2"], random: seededRandom(1) })
      calvin.hand.add(["coffee"])

      expect(small.beanTypes().map((beanType) => beanType.key)).not.toContain("coffee")
      expect(small.beanTypes().map((beanType) => beanType.key)).not.toContain("golden")
      expect(game.beanTypes().map((beanType) => beanType.key)).toContain("coffee")
      expect(game.beanTypes().map((beanType) => beanType.key)).not.toContain("golden")
    })

    it("rejects too few or too many players", () => {
      expect(() => Game.start({ names: ["Calvin", "Bot"] })).toThrow("Bean Bazaar needs 3..5 players")
      expect(() => Game.start({ names: ["A", "B", "C", "D", "E", "F"] })).toThrow()
    })
  })

  describe("phase 1: planting from hand", () => {
    it("plants the front card, then optionally the second", () => {
      game.plantFromHand(0)

      expect(game.phase).toBe("plant")

      game.plantFromHand(1)

      expect(calvin.fields.map((field) => field.bean)).toEqual(["blue", "soy"])
      expect(calvin.hand.cards).toEqual(["red"])
    })

    it("flips straight away after the second card and refuses a third", () => {
      game.plantFromHand(0)
      game.plantFromHand(1)

      expect(game.phase).toBe("trade")
      expect(game.faceUp.cards).toEqual(["green", "stink"])
      expect(() => game.plantFromHand(0)).toThrow("You can plant at most 2 cards from your hand")
    })

    it("flips straight away when the first plant empties the hand", () => {
      calvin.hand.takeAll()
      calvin.hand.add(["blue"])
      game.plantFromHand(0)

      expect(game.phase).toBe("trade")
      expect(game.faceUp.cards).toEqual(["green", "stink"])
    })

    it("keeps the card in hand when the field doesn't fit", () => {
      calvin.plant("wax", 0)

      expect(() => game.plantFromHand(0)).toThrow(IllegalMove)
      expect(calvin.hand.cards).toEqual(["blue", "soy", "red"])
    })

    it("requires the first plant before flipping", () => {
      expect(() => game.flipCards()).toThrow("Plant the front card of your hand first")
    })

    it("lets an empty hand flip straight away", () => {
      calvin.hand.takeAll()
      game.flipCards()

      expect(game.phase).toBe("trade")
    })

    it("rejects planting from an empty hand", () => {
      calvin.hand.takeAll()

      expect(() => game.plantFromHand(0)).toThrow("Your hand is empty")
    })
  })

  describe("phase 2: trading", () => {
    beforeEach(() => {
      game.plantFromHand(0)
      game.flipCards()
    })

    it("flips 2 cards face up", () => {
      expect(game.faceUp.cards).toEqual(["green", "stink"])
    })

    it("trades between the active player and a partner", () => {
      game.trade({ partnerIndex: 1, faceUpIndexes: [0], partnerHandIndexes: [1] })

      expect(bot.pending).toEqual(["green"])
      expect(calvin.pending).toEqual(["chili"])
    })

    it("keeps traded beans out of further trades until they're planted", () => {
      game.trade({ partnerIndex: 1, faceUpIndexes: [0], partnerHandIndexes: [1] })

      expect(calvin.hand.cards).toEqual(["soy", "red"])
      expect(bot.hand.cards).toEqual(["wax"])
      expect(() => game.trade({ partnerIndex: 1, handIndexes: [2] })).toThrow(IllegalMove)
      expect(() => game.trade({ partnerIndex: 1, partnerHandIndexes: [1] })).toThrow(IllegalMove)
      expect(calvin.pending).toEqual(["chili"])
      expect(bot.pending).toEqual(["green"])
    })

    it("rejects an unknown partner", () => {
      expect(() => game.trade({ partnerIndex: 5, handIndexes: [0] })).toThrow("There is no player 5")
    })

    it("gives untraded face-up cards to the active player", () => {
      game.endTrading()

      expect(calvin.pending).toEqual(["green", "stink"])
      expect(game.phase).toBe("plant_pending")
    })

    it("blocks planting from hand", () => {
      expect(() => game.plantFromHand(1)).toThrow("You can't do that during the trade phase")
    })
  })

  describe("phase 3 and 4: planting pending cards, then drawing", () => {
    beforeEach(() => {
      game.plantFromHand(0)
      game.flipCards()
      game.trade({ partnerIndex: 1, faceUpIndexes: [0] })
      game.endTrading()
    })

    it("waits until every pending card is planted", () => {
      game.plantPending({ playerIndex: 0, pendingIndex: 0, fieldIndex: 1 })

      expect(game.phase).toBe("plant_pending")
    })

    it("draws 3 to the back of the hand and passes the turn", () => {
      game.plantPending({ playerIndex: 0, pendingIndex: 0, fieldIndex: 1 })
      game.plantPending({ playerIndex: 1, pendingIndex: 0, fieldIndex: 0 })

      expect(calvin.hand.cards).toEqual(["soy", "red", "red", "red", "red"])
      expect(game.activePlayer).toBe(bot)
      expect(game.phase).toBe("plant")
      expect(game.handPlants).toBe(0)
    })
  })

  it("skips phase 3 when nothing is pending", () => {
    calvin.hand.takeAll()
    game.flipCards()
    game.trade({ partnerIndex: 1, faceUpIndexes: [0, 1] })
    bot.pending.splice(0)
    game.endTrading()

    expect(game.activePlayer).toBe(bot)
  })

  describe("harvesting and buying a field", () => {
    it("works in any phase and discards the non-coin cards", () => {
      for (let planted = 0; planted < 4; planted++) calvin.plant("blue", 0)
      game.harvest({ playerIndex: 0, fieldIndex: 0 })

      expect(calvin.coins).toBe(1)
      expect(deck.discardPile).toEqual(["blue", "blue", "blue"])
      expect(texts(game).slice(-1)[0]).toBe("Calvin harvested 4 Blue for 1 coin")
    })

    it("discards the coins spent on a third field", () => {
      calvin.coinCards.push("soy", "soy", "soy")
      game.buyThirdField({ playerIndex: 0 })

      expect(calvin.fields).toHaveLength(3)
      expect(deck.discardPile).toEqual(["soy", "soy", "soy"])
    })
  })

  describe("the end of the game", () => {
    beforeEach(() => {
      deck = new Deck({ drawPile: ["green"], discardPile: [], runOuts: 2 })
      game = new Game({ players: [calvin, bot], deck })
      calvin.plant("soy", 1)
      calvin.plant("soy", 1)
      game.plantFromHand(0)
      game.flipCards()
    })

    it("ends when the deck runs out the third time", () => {
      expect(game.isOver()).toBe(true)
    })

    it("harvests every field and clears the table", () => {
      expect(calvin.fields.every((field) => field.isEmpty())).toBe(true)
      expect(calvin.coins).toBe(1)
      expect(game.faceUp.isEmpty()).toBe(true)
    })

    it("names the player with the most coins", () => {
      expect(game.winners()).toEqual([calvin])
    })

    it("breaks a tie on coins by cards left in hand", () => {
      const tied = ["Ann", "Bea"].map((name) => new Player({ name, hand: new Hand(), coinCards: ["red"] }))
      tied[1]?.hand.add(["soy"])
      const over = new Game({ players: tied, deck: new Deck({ drawPile: [] }), phase: "over" })

      expect(over.winners()).toEqual([tied[1]])
    })

    it("logs a final harvest for each player with beans left, before the game over note", () => {
      expect(texts(game).slice(-2)).toEqual(["Calvin earned 1 coin in the final harvest", "The deck ran out for the third time. Game over!"])
      expect(game.log.slice(-2)[0]).toMatchObject({ type: "final_harvest", player: 0 })
    })

    it("blocks further moves", () => {
      expect(() => game.harvest({ playerIndex: 0, fieldIndex: 0 })).toThrow("The game is over")
      expect(() => game.buyThirdField({ playerIndex: 0 })).toThrow("The game is over")
    })
  })

  it("ends when the draw at the end of a turn exhausts the deck", () => {
    game = new Game({ players: [calvin, bot], deck: new Deck({ drawPile: ["green", "stink", "red"], runOuts: 2 }) })
    game.plantFromHand(0)
    game.flipCards()
    game.trade({ partnerIndex: 1, faceUpIndexes: [0, 1] })
    bot.pending.splice(0)
    game.endTrading()

    expect(game.isOver()).toBe(true)
  })

  describe("the game log", () => {
    it("describes planting, flipping, trading and keeping", () => {
      game.plantFromHand(0)
      game.flipCards()
      game.trade({ partnerIndex: 1, faceUpIndexes: [0], partnerHandIndexes: [1] })
      game.trade({ partnerIndex: 1, partnerHandIndexes: [0] })
      game.endTrading()

      expect(texts(game)).toEqual([
        "Calvin planted Blue",
        "Calvin flipped Green and Stink",
        "Calvin traded Green to Bot for Chili",
        "Bot gave Wax to Calvin",
        "Calvin kept Stink",
      ])
    })

    it("describes gifts, harvests, field purchases and turn changes", () => {
      game.plantFromHand(0)
      game.flipCards()
      game.trade({ partnerIndex: 1, faceUpIndexes: [0, 1] })
      bot.pending.splice(0)
      calvin.coinCards.push("red", "red", "red")
      game.buyThirdField({ playerIndex: 0 })
      game.harvest({ playerIndex: 0, fieldIndex: 0 })
      game.endTrading()

      expect(texts(game).slice(-4)).toEqual([
        "Calvin gave Green and Stink to Bot",
        "Calvin bought a third field",
        "Calvin harvested 1 Blue for 0 coins",
        "Bot's turn",
      ])
    })

    it("rejects harvesting a field that doesn't exist", () => {
      expect(() => game.harvest({ playerIndex: 0, fieldIndex: 5 })).toThrow("There is no field 5")
    })

    it("keeps only the latest entries", () => {
      const oldEntries = Array.from({ length: 60 }, (_entry, index) => ({ seq: index, text: `Entry ${index}` }) as LogEvent)
      const longGame = new Game({ players: [calvin, bot], deck, log: oldEntries, eventSeq: 60 })
      longGame.plantFromHand(0)

      expect(longGame.log).toHaveLength(60)
      expect(longGame.log.slice(-1)[0]).toMatchObject({ seq: 61, type: "plant", player: 0, text: "Calvin planted Blue" })
    })

    it("snapshots the public table with every entry, hiding hands", () => {
      game.plantFromHand(0)
      const table = game.log.slice(-1)[0]?.table

      expect(table?.players[0]).toEqual({ hand_size: 2, coins: 0, fields: [{ bean: "blue", count: 1 }, { bean: null, count: 0 }], pending: [] })
      expect(table).toMatchObject({ phase: "plant", active_index: 0, face_up: [] })
      expect(table?.deck).toEqual({ draw: 6, discard: 0, discard_top: [], run_outs: 0 })
    })

    it("notes the end of the game, even when the flip finds no cards", () => {
      game = new Game({ players: [calvin, bot], deck: new Deck({ drawPile: [], runOuts: 2 }) })
      game.plantFromHand(0)
      game.flipCards()

      expect(texts(game).slice(-1)[0]).toBe("The deck ran out for the third time. Game over!")
      expect(texts(game).some((text) => text.startsWith("Calvin flipped"))).toBe(false)
    })
  })

  describe("offers", () => {
    beforeEach(() => {
      game.plantFromHand(0)
      game.flipCards()
    })

    it("waits for the partner to accept, then trades the asked-for beans", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [0], partnerBeans: ["chili"] })

      expect(game.offer).toEqual({ partner_index: 1, face_up_indexes: [0], hand_indexes: [], partner_beans: ["chili"], choices: [] })
      expect(texts(game).slice(-1)[0]).toBe("Calvin offers Bot Green for Chili")
      expect(() => game.endTrading()).toThrow("Answer the waiting offer first")

      game.acceptOffer()

      expect(game.offer).toBeNull()
      expect(bot.pending).toEqual(["green"])
      expect(calvin.pending).toEqual(["chili"])
      expect(game.offersThisTurn).toBe(1)
    })

    it("lets the partner pick any one of the choices", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [0], choices: ["soy", "chili"] })

      expect(texts(game).slice(-1)[0]).toBe("Calvin offers Bot Green for Soy or Chili")
      expect(() => game.acceptOffer({ bean: "soy" })).toThrow("You have no Soy to give")
      expect(() => game.acceptOffer({ bean: "wax" })).toThrow("Pick one of Soy or Chili to give")

      game.acceptOffer({ bean: "chili" })

      expect(calvin.pending).toEqual(["chili"])
      expect(bot.pending).toEqual(["green"])
    })

    it("remembers which choices a partner lacked when they decline", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [0], choices: ["soy", "chili"] })
      game.declineOffer()

      expect(game.lacking[1]).toEqual(["soy"])
      expect(game.isDeclined({ partnerIndex: 1, faceUpIndexes: [0], choices: ["chili", "soy"] })).toBe(true)
    })

    describe("bidding", () => {
      // Calvin offers the Green; the bot makes its own offers instead.
      beforeEach(() => {
        game.propose({ partnerIndex: 1, faceUpIndexes: [0], partnerBeans: ["chili"] })
        game.openBids()
      })

      it("turns the offer down and waits for the bidder", () => {
        expect(game.offer).toBeNull()
        expect(game.bidding).toBe(1)
        expect(game.isDeclined({ partnerIndex: 1, faceUpIndexes: [0], partnerBeans: ["chili"] })).toBe(true)
        expect(roundTrip(game).bidding).toBe(1)
        expect(() => game.endTrading()).toThrow("Wait for the bids to finish")
      })

      it("trades the bidder's hand cards for face-up cards and beans from the active hand", () => {
        game.bid({ faceUpIndexes: [1], activeBeans: ["red"], bidderHandIndexes: [0] })

        expect(bot.pending).toEqual(["stink", "red"])
        expect(calvin.pending).toEqual(["wax"])
        expect(texts(game).slice(-1)[0]).toBe("Calvin traded Stink and Red to Bot for Wax")
        expect(() => game.bid({ activeBeans: ["blue"] })).toThrow("Calvin has no Blue to give")
      })

      it("closes, and refuses bids once closed", () => {
        game.closeBids()

        expect(game.bidding).toBeNull()
        expect(() => game.bid({ faceUpIndexes: [0] })).toThrow("Nobody is making offers right now")
      })
    })

    it("can be declined, leaving the cards where they were", () => {
      game.propose({ partnerIndex: 1, handIndexes: [0] })
      game.declineOffer()

      expect(game.offer).toBeNull()
      expect(calvin.hand.cards).toEqual(["soy", "red"])
      expect(texts(game).slice(-1)[0]).toBe("Bot turned down Calvin's offer")
    })

    it("remembers a turned-down offer by its beans, even after a save", () => {
      game.propose({ partnerIndex: 1, handIndexes: [0], partnerBeans: ["chili"] })
      game.declineOffer()

      expect(game.isDeclined({ partnerIndex: 1, handIndexes: [0], partnerBeans: ["chili"] })).toBe(true)
      expect(game.isDeclined({ partnerIndex: 1, handIndexes: [1], partnerBeans: ["chili"] })).toBe(false)
      expect(roundTrip(game).declined).toEqual(game.declined)
    })

    it("describes gifts and plain asks", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [1] })
      expect(texts(game).slice(-1)[0]).toBe("Calvin offers Bot Stink as a gift")
      game.declineOffer()

      game.propose({ partnerIndex: 1, partnerBeans: ["wax"] })
      expect(texts(game).slice(-1)[0]).toBe("Calvin asks Bot for Wax")
    })

    it("fails to accept when the partner lacks the asked-for bean", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [0], partnerBeans: ["soy"] })

      expect(() => game.acceptOffer()).toThrow("You have no Soy to give")
      expect(game.offer).not.toBeNull()
    })

    it("rejects bad offers", () => {
      expect(() => game.propose({ partnerIndex: 0, handIndexes: [0] })).toThrow("You can't trade with yourself")
      expect(() => game.propose({ partnerIndex: 1 })).toThrow("An offer needs at least one card")
      expect(() => game.propose({ partnerIndex: 1, faceUpIndexes: [5] })).toThrow(IllegalMove)
      expect(() => game.acceptOffer()).toThrow("There is no offer to answer")
      expect(() => game.declineOffer()).toThrow("There is no offer to answer")
    })

    it("blocks a second offer or a direct trade while one waits", () => {
      game.propose({ partnerIndex: 1, handIndexes: [0] })

      expect(() => game.propose({ partnerIndex: 1, handIndexes: [1] })).toThrow("Answer the waiting offer first")
      expect(() => game.trade({ partnerIndex: 1, handIndexes: [1] })).toThrow("Answer the waiting offer first")
    })

    it("remembers the beans a partner turned down an ask without holding", () => {
      game.propose({ partnerIndex: 1, faceUpIndexes: [0], partnerBeans: ["chili", "chili", "wax", "soy"] })
      game.declineOffer()

      // Bot holds one chili and one wax, so only the second chili and the soy were missing.
      expect(game.lacking).toEqual([[], ["chili", "soy"]])
    })

    it("resets the offer count each turn", () => {
      game.propose({ partnerIndex: 1, handIndexes: [0] })
      game.declineOffer()
      game.trade({ partnerIndex: 1, faceUpIndexes: [0, 1] })
      bot.pending.splice(0)
      game.endTrading()

      expect(game.offersThisTurn).toBe(0)
    })
  })

  describe("saving and loading", () => {
    it("forgets what a player lacks once they draw, and keeps it through a JSON round trip", () => {
      game = new Game({ players: [calvin, bot], deck, phase: "trade", handPlants: 1, lacking: [["wax"], ["soy"]] })
      expect(roundTrip(game).lacking).toEqual([["wax"], ["soy"]])

      game.endTrading()

      expect(game.lacking).toEqual([[], ["soy"]])
    })

    it("survives a JSON round trip mid-turn", () => {
      game.plantFromHand(0)
      game.flipCards()
      game.trade({ partnerIndex: 1, faceUpIndexes: [0] })
      calvin.coinCards.push("red")
      calvin.plant("soy", 1)

      const loaded = roundTrip(game)

      expect(JSON.parse(JSON.stringify(loaded.toJSON()))).toEqual(JSON.parse(JSON.stringify(game.toJSON())))
      expect(loaded.phase).toBe("trade")
      expect(loaded.players.slice(-1)[0]?.pending).toEqual(["green"])
      expect(loaded.players[0]?.fields.map((field) => field.bean)).toEqual(["blue", "soy"])
    })
  })

  it("only names winners once the game is over", () => {
    expect(() => game.winners()).toThrow("The game isn't over yet")
  })
})
