import type { BeanKey } from "../types"

export interface BeanTypeData {
  key: BeanKey
  name: string
  copies: number
  meter: Record<string, number>
  min_players: number
}

// One kind of bean card. `meter` maps coins earned to beans needed, so
// { 1: 4, 2: 6 } pays 1 coin for 4 beans and 2 coins for 6.
// `minPlayers` keeps a bean out of smaller games, which run long enough without it.
export class BeanType {
  readonly key: BeanKey
  readonly name: string
  readonly copies: number
  readonly meter: Readonly<Record<string, number>>
  readonly minPlayers: number

  constructor({ key, name, copies, meter, minPlayers = 3 }: { key: BeanKey; name: string; copies: number; meter: Record<string, number>; minPlayers?: number }) {
    this.key = key
    this.name = name
    this.copies = copies
    this.meter = meter
    this.minPlayers = minPlayers
  }

  static readonly all: readonly BeanType[] = [
    // Coffee and Golden only join a 5-player game, making its deck 130 cards.
    new BeanType({ key: "coffee", name: "Coffee", copies: 22, meter: { 1: 4, 2: 7, 3: 9, 4: 11 }, minPlayers: 5 }),
    new BeanType({ key: "blue", name: "Blue", copies: 20, meter: { 1: 4, 2: 6, 3: 8, 4: 10 } }),
    new BeanType({ key: "chili", name: "Chili", copies: 18, meter: { 1: 3, 2: 6, 3: 8, 4: 9 } }),
    new BeanType({ key: "stink", name: "Stink", copies: 16, meter: { 1: 3, 2: 5, 3: 7, 4: 8 } }),
    new BeanType({ key: "green", name: "Green", copies: 14, meter: { 1: 3, 2: 5, 3: 6, 4: 7 } }),
    new BeanType({ key: "soy", name: "Soy", copies: 12, meter: { 1: 2, 2: 4, 3: 6, 4: 7 } }),
    new BeanType({ key: "black_eyed", name: "Black-eyed", copies: 10, meter: { 1: 2, 2: 4, 3: 5, 4: 6 } }),
    new BeanType({ key: "red", name: "Red", copies: 8, meter: { 1: 2, 2: 3, 3: 4, 4: 5 } }),
    new BeanType({ key: "wax", name: "Wax", copies: 6, meter: { 2: 2, 3: 3 } }),
    // Rare: only 4 cards, and it never pays a single coin.
    new BeanType({ key: "golden", name: "Golden", copies: 4, meter: { 2: 2, 3: 3, 4: 4 }, minPlayers: 5 }),
  ]

  static find(key: BeanKey): BeanType {
    const found = BeanType.all.find((beanType) => beanType.key === key)
    if (!found) throw new Error(`Unknown bean: ${key}`)
    return found
  }

  // The beans in a game for this many players.
  static forPlayers(playerCount: number): BeanType[] {
    return BeanType.all.filter((beanType) => beanType.minPlayers <= playerCount)
  }

  // Every card in a fresh deck for this many players, one bean key per card.
  static fullDeck(playerCount: number): BeanKey[] {
    return BeanType.forPlayers(playerCount).flatMap((beanType) => Array<BeanKey>(beanType.copies).fill(beanType.key))
  }

  // Beans needed for the next coin step above `beanCount`; null once fully paid.
  nextStep(beanCount: number): number | null {
    const above = Object.values(this.meter).filter((beansNeeded) => beansNeeded > beanCount)
    return above.length ? Math.min(...above) : null
  }

  coinsFor(beanCount: number): number {
    const reached = Object.entries(this.meter).filter(([, beansNeeded]) => beanCount >= beansNeeded).map(([coins]) => Number(coins))
    return reached.length ? Math.max(...reached) : 0
  }

  toJSON(): BeanTypeData {
    return { key: this.key, name: this.name, copies: this.copies, meter: { ...this.meter }, min_players: this.minPlayers }
  }
}
