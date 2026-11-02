import type { BeanKey } from "../types"
import { IllegalMove } from "./illegalMove"

// An ordered row of cards. A player's hand can never be reordered: new cards
// join the back and planting takes from the front. The face-up cards in the
// trading phase use the same row.
export class Hand {
  cards: BeanKey[]

  constructor(cards: BeanKey[] = []) {
    this.cards = cards
  }

  static fromJSON(cards: BeanKey[]): Hand {
    return new Hand([...cards])
  }

  toJSON(): BeanKey[] {
    return [...this.cards]
  }

  add(newCards: BeanKey[]): void {
    this.cards.push(...newCards)
  }

  front(): BeanKey | undefined {
    return this.cards[0]
  }

  takeFront(): BeanKey | undefined {
    return this.cards.shift()
  }

  takeAll(): BeanKey[] {
    return this.cards.splice(0)
  }

  // Throws unless every index points at a different card in the row.
  check(indexes: number[]): void {
    if (new Set(indexes).size !== indexes.length) throw new IllegalMove("Pick each card only once")

    const missing = indexes.find((index) => !Number.isInteger(index) || index < 0 || index > this.cards.length - 1)
    if (missing !== undefined) throw new IllegalMove(`There is no card at position ${missing}`)
  }

  // Positions of the asked-for beans, each card used once; null if one is missing.
  // Lets a player ask for bean types without seeing another player's hand.
  indexesOf(beans: BeanKey[]): number[] | null {
    const indexes: number[] = []
    for (const bean of beans) {
      const index = this.cards.findIndex((card, candidate) => card === bean && !indexes.includes(candidate))
      if (index === -1) return null

      indexes.push(index)
    }
    return indexes
  }

  // Removes the cards at `indexes` and returns them in row order.
  takeAt(indexes: number[]): BeanKey[] {
    this.check(indexes)
    return [...indexes]
      .sort((left, right) => right - left)
      .map((index) => this.cards.splice(index, 1)[0] as BeanKey)
      .reverse()
  }

  get size(): number {
    return this.cards.length
  }

  isEmpty(): boolean {
    return this.cards.length === 0
  }
}
