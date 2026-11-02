<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"

const emit = defineEmits<{ close: [] }>()

// Each step points at an element marked data-tour="…"; a missing target shows the step centred.
const STEPS = [
  {
    target: "hand",
    title: "Your hand",
    body: "Every turn you must plant the front card (marked Plant next). Drag it onto a field or press Plant here. You may plant the next card too. You can never reorder your hand, so plan ahead.",
  },
  {
    target: "fields",
    title: "Your fields",
    body: "Each field grows one bean type. Plant the same bean again to make the pile bigger. A third field costs 3 coins. Made a mistake? Undo takes back your last plant, harvest or field.",
  },
  {
    target: "fields",
    title: "Harvest for coins",
    body: "Harvest a field to earn coins: the bigger the pile, the more coins. You can't harvest a field with just 1 bean while another field has more, so plant carefully.",
  },
  {
    target: "deck",
    title: "Flip, then trade",
    body: "After planting, flip 2 cards from the deck. Trade them, or cards from your hand, with the bots. Flipped cards nobody takes stay with you, and everything you keep or get must be planted.",
  },
  {
    target: "seats",
    title: "Bots answer instantly",
    body: "On your turn, click cards to give and beans you want. Every bot answers on its seat: Deal!, No thanks, or Don't have it. A bot that says no may suggest a different deal you can take.",
  },
  {
    target: "seats",
    title: "Deals on bot turns",
    body: "Bots offer you deals on their turns too. Some let you pick which bean to give. Don't like it? Press Make my own offer to ask for what you want instead.",
  },
  {
    target: "seasons",
    title: "Win the bazaar",
    body: "Each time the deck runs out, a new season starts. When the third season's deck runs out the game ends, and whoever has the most coins wins. Easy bots are kind, Smart bots play to win. Good luck!",
  },
]

const step = ref(0)
const spot = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const current = computed(() => STEPS[step.value] ?? STEPS[0]!)
const last = computed(() => step.value === STEPS.length - 1)

function measure(): void {
  const element = document.querySelector(`[data-tour="${current.value.target}"]`)
  if (!element) {
    spot.value = null
    return
  }
  const rect = element.getBoundingClientRect()
  const padding = 8
  spot.value = { top: rect.top - padding, left: rect.left - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }
}

// Keep the card beside the highlighted area, inside the screen.
const cardStyle = computed(() => {
  if (!spot.value) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
  const below = spot.value.top + spot.value.height + 16
  const top = below + 220 < window.innerHeight ? below : Math.max(16, spot.value.top - 236)
  const left = Math.min(Math.max(16, spot.value.left), window.innerWidth - 376)
  return { top: `${top}px`, left: `${left}px` }
})

function next(): void {
  if (last.value) emit("close")
  else step.value += 1
}

watch(step, () => nextTick(measure))
onMounted(() => {
  measure()
  window.addEventListener("resize", measure)
})
onBeforeUnmount(() => window.removeEventListener("resize", measure))
</script>

<template>
  <div
    class="tour"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
  >
    <div
      v-if="spot"
      class="spot"
      :style="{ top: `${spot.top}px`, left: `${spot.left}px`, width: `${spot.width}px`, height: `${spot.height}px` }"
    />
    <div
      v-else
      class="dim"
    />
    <div
      class="card panel"
      :style="cardStyle"
    >
      <span class="count">{{ step + 1 }} / {{ STEPS.length }}</span>
      <h2 id="tour-title">
        {{ current.title }}
      </h2>
      <p>{{ current.body }}</p>
      <div class="buttons">
        <button
          class="small secondary"
          @click="emit('close')"
        >
          Skip
        </button>
        <button
          v-if="step > 0"
          class="small secondary"
          @click="step -= 1"
        >
          Back
        </button>
        <button
          class="small"
          @click="next"
        >
          {{ last ? "Let's play" : "Next" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour { position: fixed; inset: 0; z-index: 40; }
.dim { position: absolute; inset: 0; background: rgba(10, 7, 5, .7); }
/* A huge shadow darkens everything except the highlighted area. */
.spot {
  position: absolute;
  border-radius: 16px;
  box-shadow: 0 0 0 9999px rgba(10, 7, 5, .7);
  border: 3px solid var(--gold);
  transition: all .3s ease;
  pointer-events: none;
}
.card { position: absolute; width: 360px; display: grid; gap: 8px; padding: 18px; box-shadow: 0 18px 40px rgba(0, 0, 0, .6); }
.count { font-size: 12px; font-weight: 800; color: var(--muted); }
h2 { font-size: 22px; }
p { margin: 0; line-height: 1.5; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
</style>
