import type { BeanKey, FieldState } from "../types"
import { Field } from "./field"
import { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"

export interface PlayerData {
  name: string
  hand: BeanKey[]
  fields: FieldState[]
  coin_cards: BeanKey[]
  pending: BeanKey[]
}

// One seat at the table: a hand, two or three fields, earned coins, and the
// traded or face-up cards waiting to be planted this turn.
export class Player {
  static readonly STARTING_FIELDS = 2
  static readonly MAX_FIELDS = 3
  static readonly THIRD_FIELD_PRICE = 3

  readonly name: string
  readonly hand: Hand
  readonly fields: Field[]
  readonly coinCards: BeanKey[]
  readonly pending: BeanKey[]

  constructor({
    name,
    hand = new Hand(),
    fields = Array.from({ length: Player.STARTING_FIELDS }, () => new Field()),
    coinCards = [],
    pending = [],
  }: { name: string; hand?: Hand; fields?: Field[]; coinCards?: BeanKey[]; pending?: BeanKey[] }) {
    this.name = name
    this.hand = hand
    this.fields = fields
    this.coinCards = coinCards
    this.pending = pending
  }

  static fromJSON(data: PlayerData): Player {
    return new Player({
      name: data.name,
      hand: Hand.fromJSON(data.hand),
      fields: data.fields.map((field) => Field.fromJSON(field)),
      coinCards: [...data.coin_cards],
      pending: [...data.pending],
    })
  }

  toJSON(): PlayerData {
    return {
      name: this.name,
      hand: this.hand.toJSON(),
      fields: this.fields.map((field) => field.toJSON()),
      coin_cards: [...this.coinCards],
      pending: [...this.pending],
    }
  }

  // Harvested cards flip to their coin side, so coins are cards too.
  get coins(): number {
    return this.coinCards.length
  }

  plant(card: BeanKey, fieldIndex: number): void {
    this.field(fieldIndex).plant(card)
  }

  receive(cards: BeanKey[]): void {
    this.pending.push(...cards)
  }

  plantPending(pendingIndex: number, fieldIndex: number): void {
    const card = this.pending[pendingIndex]
    if (card === undefined) throw new IllegalMove(`There is no card at position ${pendingIndex}`)

    this.plant(card, fieldIndex)
    this.pending.splice(pendingIndex, 1)
  }

  // Returns the cards that go to the discard pile.
  harvest(fieldIndex: number): BeanKey[] {
    const target = this.field(fieldIndex)
    if (target.isEmpty()) throw new IllegalMove("That field is empty")
    if (this.isProtected(target)) throw new IllegalMove("Harvest a field with more beans first")

    return this.collect(target)
  }

  // End of game: every field is harvested, so the 1-bean rule doesn't apply.
  harvestAll(): BeanKey[] {
    return this.fields.filter((target) => !target.isEmpty()).flatMap((target) => this.collect(target))
  }

  // Returns the coin cards spent, which go to the discard pile.
  buyThirdField(): BeanKey[] {
    if (this.fields.length >= Player.MAX_FIELDS) throw new IllegalMove(`You already have ${Player.MAX_FIELDS} fields`)
    if (this.coins < Player.THIRD_FIELD_PRICE) throw new IllegalMove(`A third field costs ${Player.THIRD_FIELD_PRICE} coins`)

    this.fields.push(new Field())
    return this.coinCards.splice(-Player.THIRD_FIELD_PRICE)
  }

  private field(index: number): Field {
    const found = this.fields[index]
    if (!found) throw new IllegalMove(`There is no field ${index}`)
    return found
  }

  // A lone bean can't be harvested while another field has more than one.
  private isProtected(target: Field): boolean {
    return target.count === 1 && this.fields.some((other) => other.count > 1)
  }

  private collect(target: Field): BeanKey[] {
    const coins = target.coins()
    const cards = target.harvest()
    this.coinCards.push(...cards.slice(0, coins))
    return cards.slice(coins)
  }
}
