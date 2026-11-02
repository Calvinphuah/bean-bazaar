import type { BeanKey, DeckSummary } from "../types"
import { BeanType } from "./beanType"
import { shuffle, type Random } from "./random"

export interface DeckData {
  draw_pile: BeanKey[]
  discard_pile: BeanKey[]
  run_outs: number
}

// Draw pile plus discard pile. When the draw pile runs dry the discards are
// shuffled back in; the third time it runs dry the game is over.
export class Deck {
  static readonly MAX_RUN_OUTS = 3
  // The discard pile is face up; this many of its top cards are shown.
  static readonly SHOWN_DISCARDS = 3

  drawPile: BeanKey[]
  discardPile: BeanKey[]
  runOuts: number
  private readonly random: Random

  constructor({ drawPile, discardPile = [], runOuts = 0, random = Math.random }: { drawPile: BeanKey[]; discardPile?: BeanKey[]; runOuts?: number; random?: Random }) {
    this.drawPile = drawPile
    this.discardPile = discardPile
    this.runOuts = runOuts
    this.random = random
  }

  static shuffled({ playerCount, random = Math.random }: { playerCount: number; random?: Random }): Deck {
    return new Deck({ drawPile: shuffle(BeanType.fullDeck(playerCount), random), random })
  }

  static fromJSON(data: DeckData, random: Random = Math.random): Deck {
    return new Deck({ drawPile: [...data.draw_pile], discardPile: [...data.discard_pile], runOuts: data.run_outs, random })
  }

  toJSON(): DeckData {
    return { draw_pile: [...this.drawPile], discard_pile: [...this.discardPile], run_outs: this.runOuts }
  }

  // What everyone can see: pile sizes and the top of the face-up discard pile.
  summary(): DeckSummary {
    return {
      draw: this.drawPile.length,
      discard: this.discardPile.length,
      discard_top: this.discardPile.slice(-Deck.SHOWN_DISCARDS),
      run_outs: this.runOuts,
    }
  }

  // Returns up to `count` cards; fewer once the deck is exhausted.
  draw(count: number): BeanKey[] {
    const cards: BeanKey[] = []
    for (let drawn = 0; drawn < count; drawn++) {
      const card = this.drawOne()
      if (card !== undefined) cards.push(card)
    }
    return cards
  }

  discard(cards: BeanKey[]): void {
    this.discardPile.push(...cards)
  }

  isExhausted(): boolean {
    return this.runOuts >= Deck.MAX_RUN_OUTS
  }

  private drawOne(): BeanKey | undefined {
    if (this.isExhausted()) return undefined

    if (this.drawPile.length === 0) this.refill()
    return this.drawPile.shift()
  }

  private refill(): void {
    this.runOuts += 1
    if (this.isExhausted()) return

    this.drawPile = shuffle(this.discardPile, this.random)
    this.discardPile = []
  }
}
