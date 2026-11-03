<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"

const emit = defineEmits<{ close: [] }>()

// Each step points at an element marked data-tour="…"; a missing target shows the step centred.
// A touch screen has no pointer to hover with, so a few steps say it its own way.
const STEPS: { target: string; title: string; body: string; touchBody?: string }[] = [
  {
    target: "hand",
    title: "Your hand",
    body: "Every turn you must plant the front card (marked Plant next). Drag it onto a field or press Plant here. You may plant the next card too. You can never reorder your hand, so plan ahead.",
  },
  {
    target: "hand",
    title: "Reading a card",
    body: "The big number in the corner is how many of that bean are in the deck. Fewer copies means a rarer bean that pays more. Point at a card to see it big: the number under each coin stack is how many beans you need to harvest for that many coins.",
    touchBody: "The big number in the corner is how many of that bean are in the deck. Fewer copies means a rarer bean that pays more. Tap a card in your hand to lift it out. Payouts in the ☰ menu shows how many beans each coin needs.",
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
    body: "After planting, flip 2 cards from the deck. Trade them, or cards from your hand, with the bots. Flipped cards nobody takes are yours. Everything you get or keep must be planted this turn.",
  },
  {
    target: "seats",
    title: "Bots answer instantly",
    body: "On your turn, click cards to give and beans you want. Every bot answers on its seat: Deal!, No thanks, or Don't have it. A bot that says no may suggest a different deal you can take.",
    touchBody: "On your turn, tap cards to give and beans you want. Every bot answers on its seat: a yes, a no, or that it doesn't have them. A bot that says no may suggest a different deal you can take.",
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

const SPOT_PADDING = 8
// Space between the card and what it points at, and from the screen edge.
const GAP = 14
const MARGIN = 12

const touch = window.matchMedia("(hover: none)").matches
const step = ref(0)
const spot = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const card = ref<HTMLElement | null>(null)
const cardSize = ref({ width: 360, height: 240 })
const current = computed(() => STEPS[step.value] ?? STEPS[0]!)
const body = computed(() => (touch && current.value.touchBody) || current.value.body)
const last = computed(() => step.value === STEPS.length - 1)

async function measure(): Promise<void> {
  const element = document.querySelector(`[data-tour="${current.value.target}"]`)
  if (!element) {
    spot.value = null
  } else {
    // The upright phone table can scroll, so bring the target into view first.
    element.scrollIntoView({ block: "nearest" })
    const rect = element.getBoundingClientRect()
    spot.value = { top: rect.top - SPOT_PADDING, left: rect.left - SPOT_PADDING, width: rect.width + SPOT_PADDING * 2, height: rect.height + SPOT_PADDING * 2 }
  }
  // The card's height changes with each step's text, so place it by its real size.
  await nextTick()
  if (card.value) cardSize.value = { width: card.value.offsetWidth, height: card.value.offsetHeight }
}

// The card goes below, above, right or left of the highlight, the first that
// fits on screen; failing all, it takes the roomier end of the screen.
const cardStyle = computed(() => {
  const target = spot.value
  if (!target) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
  const { width, height } = cardSize.value
  const clampLeft = (left: number) => Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))
  const clampTop = (top: number) => Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN))
  const below = target.top + target.height + GAP
  const above = target.top - GAP - height
  const right = target.left + target.width + GAP
  const left = target.left - GAP - width
  let place: { top: number; left: number }
  if (below + height + MARGIN <= window.innerHeight) place = { top: below, left: clampLeft(target.left) }
  else if (above >= MARGIN) place = { top: above, left: clampLeft(target.left) }
  else if (right + width + MARGIN <= window.innerWidth) place = { top: clampTop(target.top), left: right }
  else if (left >= MARGIN) place = { top: clampTop(target.top), left }
  else {
    const roomAbove = target.top > window.innerHeight - target.top - target.height
    place = { top: roomAbove ? MARGIN : clampTop(window.innerHeight), left: clampLeft(target.left) }
  }
  return { top: `${place.top}px`, left: `${place.left}px` }
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
      ref="card"
      class="card panel"
      :style="cardStyle"
    >
      <span class="count">{{ step + 1 }} / {{ STEPS.length }}</span>
      <h2 id="tour-title">
        {{ current.title }}
      </h2>
      <p>{{ body }}</p>
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
.card { position: absolute; width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 24px); overflow-y: auto; display: grid; gap: 8px; padding: 18px; box-shadow: 0 18px 40px rgba(0, 0, 0, .6); }
.count { font-size: 12px; font-weight: 800; color: var(--muted); }
h2 { font-size: 22px; }
p { margin: 0; line-height: 1.5; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

/* A phone on its side is short: a tighter card, narrow enough to fit beside what it points at. */
@media (orientation: landscape) and (max-height: 500px) {
  .card { width: min(320px, calc(100vw - 32px)); gap: 4px; padding: 10px 14px; }
  h2 { font-size: 17px; }
  p { font-size: 13px; line-height: 1.35; }
  .buttons { margin-top: 2px; }
}
</style>
