// The few rules the screen needs to know, so it can show what a move would do
// before asking the server. The server still decides; these only guide the player.
import type { BeanKey, BeanType, FieldState, GameState, TableSnapshot } from "./types"

export const MAX_HAND_PLANTS = 2
export const MAX_FIELDS = 3
export const THIRD_FIELD_PRICE = 3
export const MAX_RUN_OUTS = 3

export function coinsFor(bean: BeanType | undefined, count: number): number {
  if (!bean) return 0
  const reached = Object.entries(bean.meter).filter(([, beans]) => count >= beans).map(([coins]) => Number(coins))
  return reached.length ? Math.max(...reached) : 0
}

// The next payout step above `count`, or null once the field pays its most.
export function nextStep(bean: BeanType | undefined, count: number): { beans: number; coins: number } | null {
  if (!bean) return null
  const steps = Object.entries(bean.meter)
    .map(([coins, beans]) => ({ coins: Number(coins), beans }))
    .filter((step) => step.beans > count)
    .sort((left, right) => left.beans - right.beans)
  return steps[0] ?? null
}

export function accepts(field: FieldState, bean: BeanKey): boolean {
  return field.bean === null || field.bean === bean
}

// A lone bean is protected while another of your fields has more than one.
export function canHarvest(fields: FieldState[], index: number): boolean {
  const field = fields[index]
  if (!field || field.count === 0) return false
  return field.count > 1 || !fields.some((other) => other.count > 1)
}

export function coinText(coins: number): string {
  return `${coins} ${coins === 1 ? "coin" : "coins"}`
}

// The engine names every seat the same way, so "Lima turned down You's offer"
// and "You's turn" are reworded to "your offer" and "Your turn".
export function addressYou(text: string, you: string): string {
  const reworded = text.split(`${you}'s `).join("your ").split(` ${you}`).join(" you")
  return reworded.charAt(0).toUpperCase() + reworded.slice(1)
}

// The current table in the same shape as a log event's snapshot.
export function tableOf(game: GameState): TableSnapshot {
  return {
    phase: game.phase,
    active_index: game.active_index,
    deck: game.deck,
    face_up: game.face_up,
    players: game.players.map(({ hand_size, coins, fields, pending }) => ({ hand_size, coins, fields, pending })),
  }
}
