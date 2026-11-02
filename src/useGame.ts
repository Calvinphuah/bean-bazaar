import { computed, ref } from "vue"
import { ApiError, loadGame, sendMove, startGame } from "./api"
import { tableOf } from "./rules"
import type { BotLevel, GameState, LogEvent, Move, TableSnapshot } from "./types"

const STORAGE_KEY = "bean-bazaar-game-id"

// How long each replayed move stays on screen, by who made it and what it was.
const BOT_STEP_MS = 900
const FLIP_STEP_MS = 1100
const OWN_STEP_MS = 220
// A plant is easy to follow, and after a trade every bot plants in a row, so these go quicker.
const PLANT_STEP_MS = 320
// Each table being cashed in at the end gets a moment, yours included.
const FINAL_HARVEST_STEP_MS = 1200

// localStorage can throw in private windows; resuming is only a convenience.
function savedId(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function saveId(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(id))
  } catch {
    // Nothing to do: the game still works, it just won't resume after a reload.
  }
}

export function useGame() {
  const game = ref<GameState | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)
  // The move being replayed right now; null when the table shows the live state.
  const replaying = ref<LogEvent | null>(null)

  let lastSeq = 0
  let queue: LogEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const table = computed<TableSnapshot | null>(() =>
    replaying.value ? replaying.value.table : game.value ? tableOf(game.value) : null,
  )

  function stepDuration(event: LogEvent): number {
    if (event.type === "final_harvest") return FINAL_HARVEST_STEP_MS
    if (event.player === game.value?.you) return OWN_STEP_MS
    if (event.type === "flip") return FLIP_STEP_MS
    return event.type === "plant" ? PLANT_STEP_MS : BOT_STEP_MS
  }

  function playNext(): void {
    const next = queue.shift()
    replaying.value = next ?? null
    timer = next ? setTimeout(playNext, stepDuration(next)) : null
  }

  function skipReplay(): void {
    if (timer) clearTimeout(timer)
    timer = null
    queue = []
    replaying.value = null
  }

  // Shows the new state, replaying the moves made since the last one we saw.
  function absorb(next: GameState, replay: boolean): void {
    const fresh = next.log.filter((event) => event.seq > lastSeq)
    lastSeq = next.log[next.log.length - 1]?.seq ?? lastSeq
    game.value = next
    saveId(next.id)
    skipReplay()
    if (!replay) return

    queue = fresh
    playNext()
  }

  async function run(action: () => Promise<GameState>, replay: boolean): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      absorb(await action(), replay)
      return true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught)
      return false
    } finally {
      busy.value = false
    }
  }

  function start(botCount: number, botLevel: BotLevel): Promise<boolean> {
    lastSeq = 0
    return run(() => startGame(botCount, botLevel), false)
  }

  async function move(next: Move): Promise<boolean> {
    const current = game.value
    if (current === null) return false
    return run(() => sendMove(current.id, next), true)
  }

  // Only a game the server no longer has is forgotten; a network blip keeps it for next time.
  async function resume(): Promise<void> {
    const id = savedId()
    if (id === null) return
    busy.value = true
    try {
      absorb(await loadGame(id), false)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) saveId(null)
      else error.value = caught instanceof Error ? caught.message : String(caught)
    } finally {
      busy.value = false
    }
  }

  function leave(): void {
    skipReplay()
    game.value = null
    error.value = null
    lastSeq = 0
    saveId(null)
  }

  return { game, table, error, busy, replaying, start, move, resume, leave, skipReplay }
}
