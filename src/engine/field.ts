import type { BeanKey, FieldState } from "../types"
import { BeanType } from "./beanType"
import { IllegalMove } from "./illegalMove"

// A bean field holds any number of beans, all of one type.
export class Field {
  bean: BeanKey | null
  count: number

  constructor({ bean = null, count = 0 }: { bean?: BeanKey | null; count?: number } = {}) {
    this.bean = bean
    this.count = count
  }

  static fromJSON(data: FieldState): Field {
    return new Field({ bean: data.bean, count: data.count })
  }

  toJSON(): FieldState {
    return { bean: this.bean, count: this.count }
  }

  isEmpty(): boolean {
    return this.count === 0
  }

  accepts(card: BeanKey): boolean {
    return this.isEmpty() || this.bean === card
  }

  plant(card: BeanKey): void {
    if (!this.accepts(card)) throw new IllegalMove(`This field already holds ${this.bean} beans`)

    this.bean = card
    this.count += 1
  }

  coins(): number {
    if (this.isEmpty() || this.bean === null) return 0

    return BeanType.find(this.bean).coinsFor(this.count)
  }

  // Empties the field and returns every card that was in it.
  harvest(): BeanKey[] {
    const cards = Array<BeanKey>(this.count).fill(this.bean as BeanKey)
    this.bean = null
    this.count = 0
    return cards
  }
}
