import type { BeanKey } from "../types"
import type { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"
import type { Player } from "./player"

// A deal between the active player and one other player. The active player
// can offer face-up and hand cards; the partner offers hand cards only. One
// side may be empty, which makes it a gift. Every traded card goes to the
// receiver's pending cards, to be planted this turn.
export class Trade {
  private readonly active: Player
  private readonly partner: Player
  private readonly faceUp: Hand
  private readonly faceUpIndexes: number[]
  private readonly handIndexes: number[]
  private readonly partnerHandIndexes: number[]

  constructor({
    active,
    partner,
    faceUp,
    faceUpIndexes = [],
    handIndexes = [],
    partnerHandIndexes = [],
  }: { active: Player; partner: Player; faceUp: Hand; faceUpIndexes?: number[]; handIndexes?: number[]; partnerHandIndexes?: number[] }) {
    this.active = active
    this.partner = partner
    this.faceUp = faceUp
    this.faceUpIndexes = faceUpIndexes
    this.handIndexes = handIndexes
    this.partnerHandIndexes = partnerHandIndexes
  }

  // Returns [cards the active player gave, cards they got back].
  execute(): [BeanKey[], BeanKey[]] {
    this.validate()

    const offered = [...this.faceUp.takeAt(this.faceUpIndexes), ...this.active.hand.takeAt(this.handIndexes)]
    const requested = this.partner.hand.takeAt(this.partnerHandIndexes)
    this.partner.receive(offered)
    this.active.receive(requested)
    return [offered, requested]
  }

  // Checks every side before moving any card, so a bad trade changes nothing.
  private validate(): void {
    if (this.active === this.partner) throw new IllegalMove("You can't trade with yourself")
    if ([this.faceUpIndexes, this.handIndexes, this.partnerHandIndexes].every((indexes) => indexes.length === 0)) {
      throw new IllegalMove("A trade needs at least one card")
    }

    this.faceUp.check(this.faceUpIndexes)
    this.active.hand.check(this.handIndexes)
    this.partner.hand.check(this.partnerHandIndexes)
  }
}
