<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import GameTable from "./components/GameTable.vue"
import StartScreen from "./components/StartScreen.vue"
import TutorialGuide from "./components/TutorialGuide.vue"
import { useGame } from "./useGame"
import { useSound } from "./useSound"
import type { BotLevel } from "./types"

const TUTORIAL_KEY = "bean-bazaar-tutorial-seen"
const ERROR_MS = 4000

const { game, table, error, busy, replaying, start, move, resume, leave, skipReplay } = useGame()
const sound = useSound()
const showTutorial = ref(false)
let errorTimer: ReturnType<typeof setTimeout> | null = null

// localStorage can throw in private windows; then the tutorial just shows each time.
function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "yes"
  } catch {
    return false
  }
}

function closeTutorial(): void {
  showTutorial.value = false
  try {
    localStorage.setItem(TUTORIAL_KEY, "yes")
  } catch {
    // Nothing to do: the tutorial will offer itself again next game.
  }
}

async function deal(botCount: number, botLevel: BotLevel): Promise<void> {
  const started = await start(botCount, botLevel)
  if (started) sound.play("deal")
  if (started && !tutorialSeen()) showTutorial.value = true
}

// Errors are hints, not failures: show them briefly, then clear them.
watch(error, (message) => {
  if (errorTimer) clearTimeout(errorTimer)
  if (message) errorTimer = setTimeout(() => { error.value = null }, ERROR_MS)
})

// Every replayed move gets its sound, yours and the bots'; a win gets the big chips.
watch(replaying, (event) => sound.cue(event, game.value))
watch(
  () => !!game.value?.over && !replaying.value,
  (finished) => {
    if (finished && game.value?.winners.includes(game.value.you)) sound.play("harvest-big")
  },
)

onMounted(resume)
</script>

<template>
  <Transition name="toast">
    <p
      v-if="error"
      class="toast"
      role="alert"
      @click="error = null"
    >
      {{ error }}
    </p>
  </Transition>

  <GameTable
    v-if="game && table"
    :game="game"
    :table="table"
    :busy="busy"
    :replaying="replaying"
    :show-tutorial="showTutorial"
    :sound-on="sound.soundOn.value"
    :move="move"
    @leave="leave"
    @skip="skipReplay"
    @tutorial="showTutorial = true"
    @tutorial-done="closeTutorial"
    @toggle-sound="sound.toggleSound"
  />

  <template v-else>
    <StartScreen
      :busy="busy"
      @start="deal"
      @tutorial="showTutorial = true"
    />
    <TutorialGuide
      v-if="showTutorial"
      @close="closeTutorial"
    />
  </template>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  margin: 0;
  max-width: min(520px, calc(100% - 32px));
  background: var(--ink);
  color: #fff;
  border: 2px solid var(--gold);
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(0, 0, 0, .5);
  cursor: pointer;
}
.toast-enter-active, .toast-leave-active { transition: all .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -10px); }
</style>
