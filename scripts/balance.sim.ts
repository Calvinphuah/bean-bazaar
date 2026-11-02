// Bot balance sim: a scripted strong player in seat 0 against 2, 3 and 4 bots of
// each level, ported from the Rails app's review sims (sim.rb, sim_normal.rb).
// Run with `npm run sim`; tune it with env vars:
//   SIM_GAMES=300  SIM_LEVELS="easy normal smart"  SIM_MODES="notrade pro"  SIM_NAMES=plain
// Modes: allbots (seat 0 is a bot too), smartbot (seat 0 plays like a bot of the
// level), notrade (the script, never trading), pro (the script, trading via quotes).
import { it } from "vitest"
import { BeanType, BotRunner, Game, IllegalMove, NormalBot, SimpleBot, SmartBot, seededRandom, type Bot, type BotClass } from "../src/engine"
import { sortBy } from "../src/engine/collections"
import type { BeanKey } from "../src/types"

type Mode = "allbots" | "smartbot" | "notrade" | "pro"

const LEVELS: Record<string, BotClass> = { easy: SimpleBot, normal: NormalBot, smart: SmartBot }
const BOT_NAMES = ["Pinto", "Lima", "Fava", "Mung"]

const env = import.meta.env as Record<string, string | undefined>
const GAMES = Number(env.SIM_GAMES ?? 200)
const LEVEL_NAMES = (env.SIM_LEVELS ?? "easy normal smart").split(" ")
const MODES = (env.SIM_MODES ?? "notrade pro").split(" ") as Mode[]
const PLAIN_NAMES = env.SIM_NAMES === "plain"

function count(cards: BeanKey[], bean: BeanKey | null): number {
  return cards.filter((card) => card === bean).length
}

function cardTotal(game: Game): number {
  const seats = game.players.reduce(
    (sum, player) => sum + player.hand.size + player.coins + player.pending.length + player.fields.reduce((fieldSum, field) => fieldSum + field.count, 0),
    0,
  )
  return game.deck.drawPile.length + game.deck.discardPile.length + game.faceUp.size + seats
}

// The scripted strong human.
class Human {
  private readonly game: Game
  private readonly index: number
  private readonly mode: Mode
  private readonly level: BotClass

  constructor(game: Game, index: number, mode: Mode, level: BotClass) {
    this.game = game
    this.index = index
    this.mode = mode
    this.level = level
  }

  private get me() {
    return this.game.players[this.index]!
  }

  // An empty field counts as growing "no bean", as in the Ruby script.
  private grows(bean: BeanKey | null | undefined): boolean {
    return this.me.fields.some((field) => field.bean === (bean ?? null))
  }

  private fits(bean: BeanKey): boolean {
    return this.me.fields.some((field) => field.accepts(bean))
  }

  private runner(): BotRunner {
    return new BotRunner(this.game, { humanIndex: this.index, botClass: this.level })
  }

  act(): void {
    const game = this.game
    if (game.offer && game.offer.partner_index === this.index) this.answer()
    else if (game.phase === "plant_pending") this.plantPending()
    else if (game.phase === "plant") this.plantPhase()
    else if (game.phase === "trade") this.tradePhase()
    else throw new Error(`stuck ${game.phase}`)
  }

  private fieldFor(card: BeanKey): number {
    const fields = this.me.fields
    const matching = fields.findIndex((field) => field.bean === card)
    if (matching !== -1) return matching
    const empty = fields.findIndex((field) => field.isEmpty())
    if (empty !== -1) return empty

    const front = this.me.hand.cards.slice(0, 4)
    const order = sortBy(
      fields.map((_field, index) => index),
      (index) => -(fields[index]!.coins() * 10 - count(front, fields[index]!.bean) * 6 - fields[index]!.count),
    )
    for (const index of order) {
      try {
        this.game.harvest({ playerIndex: this.index, fieldIndex: index })
        return index
      } catch (caught) {
        if (!(caught instanceof IllegalMove)) throw caught
      }
    }
    throw new Error("no room")
  }

  private cashFull(): void {
    this.me.fields.forEach((field, index) => {
      if (field.isEmpty() || BeanType.find(field.bean!).nextStep(field.count) !== null) return
      this.game.harvest({ playerIndex: this.index, fieldIndex: index })
    })
  }

  private plantPhase(): void {
    const game = this.game
    if (this.me.fields.length === 2 && this.me.coins >= 3 && game.deck.runOuts < 2) game.buyThirdField({ playerIndex: this.index })
    if (this.me.hand.isEmpty()) return game.flipCards()

    game.plantFromHand(this.fieldFor(this.me.hand.front()!))
    if (game.phase !== "plant") return
    const next = this.me.hand.front()
    if (next !== undefined && (this.grows(next) || (this.fits(next) && this.me.fields.filter((field) => field.isEmpty()).length > 1))) {
      game.plantFromHand(this.fieldFor(next))
    }
    if (game.isOver()) return
    this.cashFull()
    if (game.phase === "plant") game.flipCards()
  }

  private plantPending(): void {
    const pending = this.me.pending
    const growing = pending.findIndex((card) => this.grows(card))
    const fitting = pending.findIndex((card) => this.fits(card))
    const index = growing !== -1 ? growing : fitting !== -1 ? fitting : 0
    this.game.plantPending({ playerIndex: this.index, pendingIndex: index, fieldIndex: this.fieldFor(pending[index]!) })
  }

  private answer(): void {
    const game = this.game
    const offer = game.offer!
    const gives = [...offer.face_up_indexes.map((index) => game.faceUp.cards[index]!), ...offer.hand_indexes.map((index) => game.activePlayer.hand.cards[index]!)]
    const choices = offer.choices ?? []
    // With choices, give the held bean we care least about.
    const held = choices.filter((bean) => this.me.hand.cards.includes(bean))
    const pick = held.find((bean) => !this.grows(bean)) ?? held[0]
    const asks = choices.length > 0 ? (pick === undefined ? [] : [pick]) : offer.partner_beans
    const emptyFields = this.me.fields.filter((field) => field.isEmpty()).length
    const useful = gives.every((bean) => this.grows(bean)) || (gives.length === 1 && emptyFields >= 1 && !this.grows(asks[0]))
    const key = asks.some((bean) => this.grows(bean))
    if (useful && !key && this.me.hand.indexesOf(asks) !== null && (choices.length === 0 || pick !== undefined)) {
      game.acceptOffer({ bean: pick })
    } else {
      bidRound(game, this.level)
    }
  }

  private bots(): number[] {
    return this.game.players.map((_player, index) => index).filter((index) => index !== this.index)
  }

  // Mirrors quoteTrade's answer for one bot.
  private quote(index: number, offered: BeanKey[], asks: BeanKey[]): "missing" | "accept" | "counter" | "decline" {
    const partner = this.game.players[index]!
    const handIndexes = partner.hand.indexesOf(asks)
    if (handIndexes === null) return "missing"
    const requested = handIndexes.map((handIndex) => partner.hand.cards[handIndex]!)
    const bot = this.runner().bot(index)
    if (bot.accepts({ offered, requested })) return "accept"
    return bot.counterOffer({ offered, requested }) ? "counter" : "decline"
  }

  private doTrade(index: number, faceUpIndexes: number[], handIndexes: number[], asks: BeanKey[]): void {
    const partnerHandIndexes = this.game.players[index]!.hand.indexesOf(asks) ?? []
    this.game.trade({ partnerIndex: index, faceUpIndexes, handIndexes, partnerHandIndexes })
  }

  // Beans to ask for: beans we grow, most urgent first.
  private wish(): BeanKey[] {
    const growing = this.me.fields.filter((field) => !field.isEmpty())
    return sortBy(growing, (field) => (BeanType.find(field.bean!).nextStep(field.count) ?? 0) - field.count).map((field) => field.bean!)
  }

  private tryUnload({ faceUpIndexes = [], handIndexes = [] }: { faceUpIndexes?: number[]; handIndexes?: number[] }): boolean {
    const cards = [...faceUpIndexes.map((index) => this.game.faceUp.cards[index]!), ...handIndexes.map((index) => this.me.hand.cards[index]!)]
    // feed the poorest bot
    const order = sortBy(this.bots(), (index) => this.game.players[index]!.coins)
    const askLists: BeanKey[][] = [...this.wish().flatMap((bean) => [[bean, bean], [bean]]), []]
    for (const asks of askLists) {
      for (const index of order) {
        if (this.quote(index, cards, asks) !== "accept") continue
        this.doTrade(index, faceUpIndexes, handIndexes, asks)
        return true
      }
    }
    return false
  }

  // Asks bots for beans we grow, paying nothing.
  private shop(): void {
    for (const bean of this.wish()) {
      for (const index of this.bots()) {
        if (this.quote(index, [], [bean]) === "accept") this.doTrade(index, [], [], [bean])
      }
    }
  }

  private tradePhase(): void {
    if (this.mode === "pro") {
      for (;;) {
        const faceUpIndex = this.game.faceUp.cards.findIndex((card) => !this.grows(card))
        if (faceUpIndex === -1 || !this.tryUnload({ faceUpIndexes: [faceUpIndex] })) break
      }
      for (;;) {
        const cards = this.me.hand.cards
        let handIndex = -1
        for (let index = cards.length - 1; index > 0; index--) {
          if (!this.fits(cards[index]!)) {
            handIndex = index
            break
          }
        }
        if (handIndex === -1 || !this.tryUnload({ handIndexes: [handIndex] })) break
      }
      this.shop()
    }
    this.game.endTrading()
  }
}

function bidRound(game: Game, level: BotClass): void {
  game.openBids()
  const me = new level(game, 0)
  const active: Bot = new BotRunner(game, { humanIndex: 0, botClass: level }).bot(game.activeIndex)
  for (;;) {
    let done = true
    for (let faceUpIndex = 0; faceUpIndex < game.faceUp.cards.length && done; faceUpIndex++) {
      const card = game.faceUp.cards[faceUpIndex]!
      const hand = game.players[0]!.hand.cards
      let junk = -1
      for (let index = hand.length - 1; index >= 0; index--) {
        if (!game.players[0]!.fields.some((field) => field.accepts(hand[index]!))) {
          junk = index
          break
        }
      }
      const giveLists = junk === -1 ? [[]] : [[junk], []]
      for (const giveIndexes of giveLists) {
        const gives = giveIndexes.map((index) => hand[index]!)
        if (!me.accepts({ offered: [card], requested: gives })) continue
        if (!active.accepts({ offered: gives, requested: [card] })) continue
        game.bid({ faceUpIndexes: [faceUpIndex], bidderHandIndexes: giveIndexes })
        done = false
        break
      }
    }
    if (done) break
  }
  game.closeBids()
}

// Seat 0 plays like a bot of the level, but answers offers and bids as the human seat.
function playAsBot(game: Game, level: BotClass, bots: number): void {
  const self = new level(game, 0)
  const offer = game.offer
  if (offer && offer.partner_index === 0) {
    const gives = [...offer.face_up_indexes.map((index) => game.faceUp.cards[index]!), ...offer.hand_indexes.map((index) => game.activePlayer.hand.cards[index]!)]
    const choices = offer.choices ?? []
    const hand = game.players[0]!.hand.cards
    const pick = choices.find((bean) => hand.includes(bean) && self.accepts({ offered: gives, requested: [bean] }))
    const asks = choices.length > 0 ? (pick === undefined ? [] : [pick]) : offer.partner_beans
    const indexes = game.players[0]!.hand.indexesOf(asks)
    const requested = (indexes ?? []).map((index) => hand[index]!)
    if (indexes !== null && (choices.length === 0 || pick !== undefined) && self.accepts({ offered: gives, requested })) game.acceptOffer({ bean: pick })
    else bidRound(game, level)
  } else if (game.phase === "plant_pending") self.plantPending()
  else if (game.phase === "plant") self.playPlantPhase()
  else self.playTradePhase({ partnerIndexes: Array.from({ length: bots }, (_bot, index) => index + 1), humanIndex: null })
}

function play(seed: number, bots: number, mode: Mode, level: BotClass): Game {
  const names = ["You", ...(PLAIN_NAMES ? Array.from({ length: bots }, (_bot, index) => `Bot${index + 1}`) : BOT_NAMES.slice(0, bots))]
  const game = Game.start({ names, random: seededRandom(seed) })
  const runner = new BotRunner(game, { humanIndex: mode === "allbots" ? null : 0, botClass: level })
  const human = new Human(game, 0, mode === "smartbot" ? "notrade" : mode, level)
  const full = BeanType.fullDeck(game.players.length).length
  for (let steps = 0; !game.isOver(); steps++) {
    runner.run()
    if (game.isOver()) break
    if (cardTotal(game) !== full) throw new Error(`cards ${cardTotal(game)}`)
    if (mode === "smartbot") playAsBot(game, level, bots)
    else human.act()
    if (steps > 5000) throw new Error("too many steps")
    if (!game.isOver() && cardTotal(game) !== full) throw new Error(`cards ${cardTotal(game)}`)
  }
  return game
}

it("prints seat 0 win rates against each bot level", () => {
  const lines: string[] = [`${GAMES} games each, ${PLAIN_NAMES ? "plain bot names" : "personality bot names"}`]
  for (const levelName of LEVEL_NAMES) {
    const level = LEVELS[levelName]!
    for (const mode of MODES) {
      const rates = [2, 3, 4].map((bots) => {
        let wins = 0
        let errors = 0
        for (let seed = 0; seed < GAMES; seed++) {
          try {
            const game = play(seed, bots, mode, level)
            const winners = game.winners()
            if (winners.includes(game.players[0]!)) wins += 1 / winners.length
          } catch (caught) {
            errors += 1
            if (errors < 3) console.error(`seed ${seed} ${levelName}/${mode}/${bots}:`, caught)
          }
        }
        return `${Math.round((100 * wins) / GAMES)}%${errors ? ` (${errors} errors)` : ""}`
      })
      lines.push(`${levelName.padEnd(6)} ${mode.padEnd(8)} vs 2/3/4 bots: ${rates.join(" / ")}`)
    }
  }
  console.info(lines.join("\n"))
})
