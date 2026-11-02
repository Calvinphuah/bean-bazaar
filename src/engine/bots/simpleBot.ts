import type { BeanKey } from "../../types"
import { maxBy, sortBy, uniq } from "../collections"
import { Game } from "../game"
import { Player } from "../player"
import type { Bot, BotClass, CounterOffer, Deal } from "./bot"

// Plays by simple rules: plant where a card fits, keep beans that match its
// fields, give away the rest, and harvest the best field when it needs room.
// This is the "easy" bot; SmartBot builds on it. BotRunner only calls the
// public methods below.
export class SimpleBot implements Bot {
  protected readonly game: Game
  protected readonly playerIndex: number

  constructor(game: Game, playerIndex: number) {
    this.game = game
    this.playerIndex = playerIndex
  }

  playPlantPhase(): void {
    if (!this.player.hand.isEmpty()) this.plantFront()
    if (this.wantsSecondPlant()) this.plantFront()
    if (this.game.isOver()) return

    this.buyFieldIfRich()
    if (this.game.phase === "plant") this.game.flipCards()
  }

  // Offers face-up cards it can't use to other bots, then ends trading.
  // The easy bot never makes offers to the human.
  playTradePhase({ partnerIndexes }: { partnerIndexes: number[]; humanIndex?: number | null }): void {
    this.offerUnwantedCards(partnerIndexes)
    this.game.endTrading()
  }

  plantPending(): void {
    while (this.player.pending.length > 0 && this.game.phase === "plant_pending") {
      const card = this.player.pending[0] as BeanKey
      this.game.plantPending({ playerIndex: this.playerIndex, pendingIndex: 0, fieldIndex: this.fieldFor(card) })
    }
  }

  // As a trade partner: take cards it can plant, never give away a bean it grows.
  accepts({ offered, requested }: Deal): boolean {
    return this.plantableTogether(offered) && !requested.some((card) => this.grows(card))
  }

  // The easy bot just says no; it never suggests a smaller deal.
  counterOffer(_deal: Deal): CounterOffer | null {
    return null
  }

  grows(card: BeanKey): boolean {
    return this.player.fields.some((field) => field.bean === card)
  }

  protected get player(): Player {
    return this.game.players[this.playerIndex] as Player
  }

  protected plantFront(): void {
    this.game.plantFromHand(this.fieldFor(this.player.hand.front() as BeanKey))
  }

  protected wantsSecondPlant(): boolean {
    const card = this.player.hand.front()
    return this.game.handPlants < Game.MAX_HAND_PLANTS && card !== undefined && this.fits(card)
  }

  // Each new bean type needs its own empty field, so two strangers can't share one.
  protected plantableTogether(cards: BeanKey[]): boolean {
    const strangers = uniq(cards).filter((card) => !this.grows(card)).length
    return strangers <= this.player.fields.filter((field) => field.isEmpty()).length
  }

  protected fits(card: BeanKey): boolean {
    return this.player.fields.some((field) => field.accepts(card))
  }

  protected buyFieldIfRich(): void {
    if (this.player.fields.length >= Player.MAX_FIELDS) return
    if (this.player.coins < Player.THIRD_FIELD_PRICE) return

    this.game.buyThirdField({ playerIndex: this.playerIndex })
  }

  // Same bean first, then an empty field, otherwise harvest to make room.
  protected fieldFor(card: BeanKey): number {
    const matching = this.player.fields.findIndex((field) => field.bean === card)
    if (matching !== -1) return matching

    const empty = this.player.fields.findIndex((field) => field.isEmpty())
    return empty !== -1 ? empty : this.makeRoom()
  }

  protected makeRoom(): number {
    const fields = this.player.fields
    const fieldIndex = maxBy(this.harvestableIndexes(), (index) => {
      const field = fields[index]!
      return [field.coins(), -field.count]
    }) as number
    this.game.harvest({ playerIndex: this.playerIndex, fieldIndex })
    return fieldIndex
  }

  protected harvestableIndexes(): number[] {
    const fields = this.player.fields
    const crowded = fields.some((field) => field.count > 1)
    return fields.map((_field, index) => index).filter((index) => !(crowded && fields[index]!.count === 1))
  }

  protected offerUnwantedCards(partnerIndexes: number[]): void {
    for (;;) {
      const faceUpIndex = this.unwantedFaceUpIndex()
      if (faceUpIndex === null) break
      if (!this.offer(partnerIndexes, { faceUpIndexes: [faceUpIndex] })) break
    }
  }

  protected unwantedFaceUpIndex(): number | null {
    const index = this.game.faceUp.cards.findIndex((card) => !this.grows(card))
    return index === -1 ? null : index
  }

  // Offers face-up or hand cards to the poorest partner first, so no seat gets
  // every gift. It asks for the bean it wants when that partner holds one, the
  // way the human must, otherwise gives them away. False if nobody wants them.
  protected offer(partnerIndexes: number[], { faceUpIndexes = [], handIndexes = [] }: { faceUpIndexes?: number[]; handIndexes?: number[] }): boolean {
    const cards = [
      ...faceUpIndexes.map((index) => this.game.faceUp.cards[index] as BeanKey),
      ...handIndexes.map((index) => this.player.hand.cards[index] as BeanKey),
    ]

    for (const partnerIndex of sortBy(partnerIndexes, (index) => [this.game.players[index]!.coins, index])) {
      const wantedIndex = this.askedIndex(partnerIndex)
      const requested = wantedIndex === null ? [] : [this.game.players[partnerIndex]!.hand.cards[wantedIndex] as BeanKey]
      const partnerBot = new (this.constructor as BotClass)(this.game, partnerIndex)
      if (!partnerBot.accepts({ offered: cards, requested })) continue

      this.game.trade({ partnerIndex, faceUpIndexes, handIndexes, partnerHandIndexes: wantedIndex === null ? [] : [wantedIndex] })
      return true
    }
    return false
  }

  // Where the bean it asks for sits in the partner's hand; null when the partner
  // has none, which is all the asker learns, just like a "Don't have it".
  protected askedIndex(partnerIndex: number): number | null {
    const bean = this.wantedBean(partnerIndex)
    if (bean === null) return null

    const index = this.game.players[partnerIndex]!.hand.cards.indexOf(bean)
    return index === -1 ? null : index
  }

  // The bean of its first planted field the partner hasn't said they lack.
  protected wantedBean(partnerIndex: number): BeanKey | null {
    const lacking = this.game.lacking[partnerIndex] ?? []
    const field = this.player.fields.find((candidate) => !candidate.isEmpty() && !lacking.includes(candidate.bean as BeanKey))
    return field?.bean ?? null
  }
}
