// Ruby's Enumerable helpers the engine leans on, so the port reads like the original.
type SortKey = number | number[]

function compareKeys(left: SortKey, right: SortKey): number {
  const lefts = Array.isArray(left) ? left : [left]
  const rights = Array.isArray(right) ? right : [right]
  for (let index = 0; index < lefts.length; index++) {
    const difference = (lefts[index] ?? 0) - (rights[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

// Like Ruby's sort_by: arrays compare element by element.
export function sortBy<T>(items: T[], key: (item: T) => SortKey): T[] {
  return items
    .map((item) => ({ item, key: key(item) }))
    .sort((left, right) => compareKeys(left.key, right.key))
    .map(({ item }) => item)
}

// Like Ruby's max_by: the first of equal maximums wins; undefined when empty.
export function maxBy<T>(items: T[], key: (item: T) => SortKey): T | undefined {
  let best: { item: T; key: SortKey } | undefined
  for (const item of items) {
    const itemKey = key(item)
    if (best === undefined || compareKeys(itemKey, best.key) > 0) best = { item, key: itemKey }
  }
  return best?.item
}

// Counts of each value, in first-seen order.
export function tally<T>(items: T[]): Map<T, number> {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)]
}

export function count<T>(items: T[], value: T): number {
  return items.filter((item) => item === value).length
}

// A copy with one of `value` removed.
export function withoutOne<T>(items: T[], value: T): T[] {
  const rest = [...items]
  rest.splice(rest.indexOf(value), 1)
  return rest
}
