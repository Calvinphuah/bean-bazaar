<script setup lang="ts">
import { computed } from "vue"
import BeanCard from "./BeanCard.vue"
import { MAX_RUN_OUTS } from "../rules"
import type { BeanKey, BeanType, TableSnapshot } from "../types"

// One edge line per this many cards, so a full deck looks thick and a low one thin.
const CARDS_PER_EDGE = 12
const MAX_EDGES = 7

const props = defineProps<{
  table: TableSnapshot
  beanTypes: Record<string, BeanType>
  // Face-up cards picked for the trade you are building.
  pickedFaceUp: number[]
  pickable: boolean
}>()

// point: the bean under the pointer, so the table can show it big; null when it leaves.
const emit = defineEmits<{ pick: [index: number]; point: [bean: BeanKey | null] }>()

// Each run through the deck is a season; the game ends when the last one runs out.
const season = computed(() => Math.min(props.table.deck.run_outs + 1, MAX_RUN_OUTS))

const deckEdges = computed(() => Math.min(MAX_EDGES, Math.ceil(props.table.deck.draw / CARDS_PER_EDGE)))
// Each discard keeps its own scruffy angle and nudge, worked out from its place in
// the pile, so a card doesn't jump around when more land on top.
const discards = computed(() => {
  const top = props.table.deck.discard_top ?? []
  const firstPlace = props.table.deck.discard - top.length
  return top.map((bean, index) => {
    const place = firstPlace + index
    const angle = ((place * 37) % 29) - 14
    const nudgeX = ((place * 53) % 15) - 7
    const nudgeY = ((place * 29) % 11) - 5
    return { bean, place, style: { transform: `translate(${nudgeX}px, ${nudgeY}px) rotate(${angle}deg)` } }
  })
})

// Card edges peeking out under the top card, like the side of a real deck.
const deckStyle = computed(() => {
  const edges = Array.from({ length: deckEdges.value }, (_, index) => {
    const depth = (index + 1) * 2
    return `0 ${depth}px 0 -1px #f4ecd8, 0 ${depth + 1}px 0 -1px rgba(43, 29, 20, .35)`
  })
  return { boxShadow: [...edges, `0 ${deckEdges.value * 2 + 8}px 16px rgba(0, 0, 0, .35)`].join(", ") }
})
</script>

<template>
  <div class="center">
    <div class="piles">
      <div
        class="pile"
        data-tour="deck"
      >
        <div
          class="pile-cards"
          :class="{ empty: !table.deck.draw }"
        >
          <img
            v-if="table.deck.draw"
            class="back"
            :style="deckStyle"
            src="/cards/coin_back.webp"
            alt=""
          >
          <span
            v-if="table.deck.draw"
            class="count"
          >{{ table.deck.draw }}</span>
        </div>
        <span class="label">Deck</span>
      </div>
      <div class="pile">
        <div
          class="pile-cards"
          :class="{ empty: !table.deck.discard }"
        >
          <template
            v-for="card in discards"
            :key="card.place"
          >
            <div
              v-if="beanTypes[card.bean]"
              class="tossed"
              :style="card.style"
            >
              <BeanCard
                :bean="beanTypes[card.bean]!"
                size="small"
              />
            </div>
          </template>
          <span
            v-if="table.deck.discard"
            class="count"
          >{{ table.deck.discard }}</span>
        </div>
        <span class="label">Discard</span>
      </div>
      <div
        class="seasons"
        data-tour="seasons"
        title="A new season starts each time the deck runs out. The game ends when the last season's deck runs out."
      >
        <span>Season {{ season }} of {{ MAX_RUN_OUTS }}</span>
        <span class="bar">
          <span
            v-for="run in MAX_RUN_OUTS"
            :key="run"
            class="segment"
            :class="{ past: run < season, now: run === season }"
          />
        </span>
      </div>
    </div>

    <div
      class="face-up"
      data-tour="face-up"
    >
      <TransitionGroup name="flip">
        <!-- One steady wrapper per card: when trading opens and the card turns into a
             button, swapping the element itself would replay the flip beside the old card. -->
        <span
          v-for="(bean, index) in table.face_up"
          :key="`${bean}-${index}`"
          class="face-card"
        >
          <button
            v-if="beanTypes[bean] && pickable"
            class="card-button"
            :aria-pressed="pickedFaceUp.includes(index)"
            :aria-label="`Offer the face-up ${beanTypes[bean]!.name} bean`"
            @click="emit('pick', index)"
            @mouseenter="emit('point', bean)"
            @mouseleave="emit('point', null)"
          >
            <BeanCard
              :bean="beanTypes[bean]!"
              size="medium"
              :selected="pickedFaceUp.includes(index)"
            />
          </button>
          <BeanCard
            v-else-if="beanTypes[bean]"
            :bean="beanTypes[bean]!"
            size="medium"
            @mouseenter="emit('point', bean)"
            @mouseleave="emit('point', null)"
          />
        </span>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.center { display: flex; align-items: center; gap: 28px; }
.piles { display: grid; grid-template-columns: auto auto; gap: 12px 22px; align-items: end; justify-items: center; }
.pile { display: grid; justify-items: center; gap: 18px; }
.label { font-size: 13px; font-weight: 800; color: #fff6dc; text-shadow: 0 1px 0 rgba(0, 0, 0, .5); }
.pile-cards { position: relative; width: 92px; aspect-ratio: 63 / 88; }
/* An empty pile leaves a faint patch where the cards were. */
.pile-cards.empty { border-radius: 9px; background: rgba(30, 14, 4, .1); }
.back { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 8px; border: 2px solid #fff; }
.tossed { position: absolute; inset: 0; }
.count {
  position: absolute;
  top: -9px;
  right: -9px;
  z-index: 2;
  min-width: 28px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--panel);
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 0 var(--ink);
}
.seasons {
  grid-column: 1 / -1;
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(30, 14, 4, .28);
  font-size: 12px;
  font-weight: 800;
  color: #fff6dc;
}
.bar { display: flex; gap: 3px; }
.segment { width: 16px; height: 6px; border-radius: 999px; background: rgba(255, 246, 220, .25); }
.segment.past { background: var(--gold-dark); }
.segment.now { background: var(--gold); }

/* Room for two cards even before the flip, so the deck doesn't jump sideways. */
.face-up { display: flex; gap: 14px; min-height: 160px; min-width: 238px; justify-content: center; align-items: center; }
.face-card { display: flex; }

/* Each flipped card hops off the deck, turns face up mid-air and settles. */
.flip-enter-active { animation: hop .6s var(--ease-bounce) both; }
@keyframes hop {
  0% { opacity: 0; transform: translateX(-90px) translateY(0) rotateY(90deg) scale(.8); }
  55% { opacity: 1; transform: translateX(-10px) translateY(-18px) rotateY(0) scale(1.05); }
}
.flip-leave-active { transition: all .3s ease; }
.flip-leave-to { opacity: 0; transform: translateY(40px) scale(.85); }

@media (orientation: portrait) and (max-width: 1024px), (orientation: landscape) and (max-height: 500px) {
  .center { gap: 16px; }
  .piles { gap: 6px 14px; }
  /* A full deck's edges hang about 15px below the cards, clear of the label. */
  .pile { gap: 16px; }
  .pile-cards { width: 50px; }
  /* The discards fill their pile, however small, instead of spilling over its label. */
  .tossed :deep(.card) { width: 100%; padding: 2px; border-radius: 6px; }
  .tossed :deep(.name) { display: none; }
  /* Too small for a three-line name over the art: the picture and its coin row say which bean it is. */
  .face-up :deep(.name) { display: none; }
  /* A picked card keeps its gold ring but doesn't lift, so it can't rise into the bots' replies above. */
  .face-up :deep(.card.selected) { transform: none; }
  /* Over a tall discard pile rather than under it. */
  .label { position: relative; z-index: 1; font-size: 13px; }
  .count { top: -8px; right: -8px; min-width: 26px; height: 24px; font-size: 13px; }
  .seasons { gap: 6px; padding: 2px 8px; font-size: 12px; }
  .segment { width: 12px; }
  .face-up { gap: 8px; min-height: 120px; min-width: 164px; }
}

/* Upright, the bots' replies hang just above the piles, so each count sits inside its pile's corner instead of poking up under them. */
@media (orientation: portrait) and (max-width: 1024px) {
  .count { top: 4px; }
}

/* On its side the phone is short, so the flipped cards sit under the deck. */
@media (orientation: landscape) and (max-height: 500px) {
  /* Room for a picked card's lift and glow, so it never covers the season bar. */
  .center { flex-direction: column; gap: 16px; }
  .face-up { min-height: 108px; }
  /* Above the picked market card's glow, which reaches up to it on a short screen. */
  .seasons { position: relative; z-index: 2; }
  .pile-cards { width: 44px; }
}
</style>
