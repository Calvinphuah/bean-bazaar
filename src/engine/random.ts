// A small seeded random number generator (mulberry32), so tests and sims repeat.
// Returns numbers in [0, 1), like Math.random.
export type Random = () => number

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

// A shuffled copy (Fisher-Yates); the original is left alone.
export function shuffle<T>(items: T[], random: Random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    const held = copy[index] as T
    copy[index] = copy[swap] as T
    copy[swap] = held
  }
  return copy
}
