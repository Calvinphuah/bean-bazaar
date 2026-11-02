import { ref, watch } from "vue"
import type { GameState, LogEvent } from "./types"

const SETTINGS_KEY = "bean-bazaar-sound"
// Quiet by design: sounds mark moments, with no music underneath.
const SOUND_VOLUME = 0.45
// Bots' moves are heard, but softer than your own.
const BOT_VOLUME_SCALE = 0.5
// A fast replay can fire the same sound in a burst; one per gap is enough.
const MIN_GAP_MS = 140
// A harvest this big gets the fuller chip sound.
const BIG_HARVEST_COINS = 3

export type SoundName =
  | "plant-1" | "plant-2" | "flip" | "trade" | "harvest-small" | "harvest-big"
  | "offer" | "your-turn" | "buy-field" | "deal"

// localStorage can throw in private windows; the setting is only a convenience.
function loadSoundOn(): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { sound?: boolean }).sound ?? true
  } catch {
    return true
  }
}

function saveSoundOn(sound: boolean): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound }))
  } catch {
    // Nothing to do: the setting just won't be remembered.
  }
}

// Sound effects for table moments, like the deal and the start of your turn.
// There is no background music, so the table stays calm.
export function useSound() {
  const soundOn = ref(loadSoundOn())
  const lastPlayed = new Map<SoundName, number>()
  let plantTurn = 0

  function play(name: SoundName, quiet = false): void {
    if (!soundOn.value) return
    const now = performance.now()
    if (now - (lastPlayed.get(name) ?? -Infinity) < MIN_GAP_MS) return
    lastPlayed.set(name, now)

    const audio = new Audio(`/sounds/${name}.mp3`)
    audio.volume = SOUND_VOLUME * (quiet ? BOT_VOLUME_SCALE : 1)
    // A blocked or missing sound must never break the game.
    audio.play().catch(() => {})
  }

  // The sound for one replayed log event, if it deserves one.
  function cue(event: LogEvent | null, game: GameState | null): void {
    if (!event || !game) return
    const mine = event.player === game.you
    const quiet = !mine
    switch (event.type) {
      case "plant":
        play(++plantTurn % 2 ? "plant-1" : "plant-2", quiet)
        break
      case "flip":
        play("flip", quiet)
        break
      case "trade":
        play("trade", quiet)
        break
      case "harvest":
        play(harvestedCoins(event) >= BIG_HARVEST_COINS ? "harvest-big" : "harvest-small", quiet)
        break
      case "final_harvest":
        play("harvest-big", quiet)
        break
      case "buy_field":
        play("buy-field", quiet)
        break
      case "offer":
        if (game.offer) play("offer")
        break
      case "turn":
        if (mine) play("your-turn")
        break
    }
  }

  // The log says "... for 2 coins"; a harvest for nothing is still a small one.
  function harvestedCoins(event: LogEvent): number {
    return Number(/for (\d+) coin/.exec(event.text)?.[1] ?? 0)
  }

  watch(soundOn, saveSoundOn)

  return {
    soundOn,
    play,
    cue,
    toggleSound: () => { soundOn.value = !soundOn.value },
  }
}
