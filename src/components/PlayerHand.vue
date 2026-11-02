<script setup lang="ts">
import { computed, ref, watch } from "vue"
import BeanCard from "./BeanCard.vue"
import { setCardDragImage } from "../dragImage"
import type { BeanKey, BeanType } from "../types"

// The fan never gets wider than its max width, so a big late-game hand still fits the screen.
const FAN = { cardWidth: 132, maxWidth: 860, maxStep: 96 }
// Phone layouts draw smaller cards (see BeanCard) in a narrower fan.
const COMPACT_FAN = { cardWidth: 96, maxWidth: 370, maxStep: 60 }
const FRONT_SIDE_KEY = "bean-bazaar-front-on-right"

const props = defineProps<{
  hand: BeanKey[]
  beanTypes: Record<string, BeanType>
  // The front card can be dragged onto a field right now.
  canPlantFront: boolean
  // Cards can be picked for a trade right now.
  pickable: boolean
  picked: number[]
  compact: boolean
}>()

// point: the bean under the pointer, so the table can show it big; null when it leaves.
const emit = defineEmits<{ pick: [index: number]; point: [bean: BeanKey | null] }>()

// localStorage can throw in private windows; then the hand just starts front-left.
function savedFrontOnRight(): boolean {
  try {
    return localStorage.getItem(FRONT_SIDE_KEY) === "yes"
  } catch {
    return false
  }
}

// Some players like the card to plant next on the right, nearest their mouse hand.
const frontOnRight = ref(savedFrontOnRight())

watch(frontOnRight, (onRight) => {
  try {
    localStorage.setItem(FRONT_SIDE_KEY, onRight ? "yes" : "no")
  } catch {
    // Nothing to do: the choice just lasts for this visit.
  }
})

// Cards in screen order, left to right; `index` is still the card's place in the hand.
const shown = computed(() => {
  const cards = props.hand.map((bean, index) => ({ bean, index }))
  return frontOnRight.value ? cards.reverse() : cards
})

const fan = computed(() => (props.compact ? COMPACT_FAN : FAN))
// How far apart neighbouring cards sit: wide for a small hand, tighter as it grows.
const step = computed(() => Math.min(fan.value.maxStep, (fan.value.maxWidth - fan.value.cardWidth) / Math.max(props.hand.length - 1, 1)))
const tilt = computed(() => Math.min(3, 30 / Math.max(props.hand.length, 1)))

// Spread the cards in a gentle arc, like a hand held at a card table.
// The tilt sits on an inner layer, because the slide animation that runs when the
// order flips wipes any transform on the slot itself.
function slotStyle(position: number): Record<string, string> {
  return {
    marginRight: position === props.hand.length - 1 ? "0" : `${step.value - fan.value.cardWidth}px`,
    zIndex: String(position + 1),
  }
}

function tiltStyle(position: number): Record<string, string> {
  const offset = position - (props.hand.length - 1) / 2
  return { transform: `rotate(${offset * tilt.value}deg) translateY(${Math.abs(offset) * tilt.value}px)` }
}

// The front card is being dragged, so its "Plant next" tag and glow step aside.
const dragging = ref(false)

function onDragStart(event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData("text/plain", "front")
  setCardDragImage(event)
  dragging.value = true
  emit("point", null)
}
</script>

<template>
  <div
    class="hand"
    data-tour="hand"
  >
    <div class="fan">
      <button
        v-if="hand.length > 1"
        class="swap small secondary"
        :class="{ 'front-right': frontOnRight }"
        :title="frontOnRight ? 'Put the card to plant next on the left' : 'Put the card to plant next on the right'"
        @click="frontOnRight = !frontOnRight"
      >
        ⇄ Next card {{ frontOnRight ? "right" : "left" }}
      </button>
      <TransitionGroup name="deal">
        <template
          v-for="({ bean, index }, position) in shown"
          :key="`${bean}-${hand.length - index}`"
        >
          <div
            v-if="beanTypes[bean]"
            class="slot"
            :class="{ front: index === 0, dragging: index === 0 && dragging }"
            :style="slotStyle(position)"
            @mouseenter="!dragging && emit('point', bean)"
            @mouseleave="emit('point', null)"
          >
            <div
              class="tilt"
              :style="tiltStyle(position)"
            >
              <span
                v-if="index === 0"
                class="next"
                :class="{ waiting: !canPlantFront }"
              >{{ canPlantFront ? "Plant next" : "Next" }}</span>
              <button
                v-if="pickable"
                class="card-button"
                :aria-pressed="picked.includes(index)"
                :aria-label="`Offer your ${beanTypes[bean]!.name} bean`"
                @click="emit('pick', index)"
              >
                <BeanCard
                  :bean="beanTypes[bean]!"
                  size="large"
                  :selected="picked.includes(index)"
                />
              </button>
              <div
                v-else
                :draggable="index === 0 && canPlantFront"
                :class="{ grabbable: index === 0 && canPlantFront }"
                @dragstart="onDragStart"
                @dragend="dragging = false"
              >
                <BeanCard
                  :bean="beanTypes[bean]!"
                  size="large"
                  :highlighted="index === 0 && canPlantFront && !dragging"
                />
              </div>
            </div>
          </div>
        </template>
      </TransitionGroup>
    </div>
    <span
      v-if="!hand.length"
      class="empty"
    >No cards in hand</span>
  </div>
</template>

<style scoped>
/* Big cards that run off the bottom of the screen, like a hand held at the table. */
.hand { position: relative; display: flex; justify-content: center; align-items: flex-end; padding: 22px 20px 0; margin-bottom: -58px; min-height: 150px; }
.fan { position: relative; display: flex; align-items: flex-end; }
/* Clear of the outermost card, which tilts out past the fan's edge. */
.swap { position: absolute; right: calc(100% + 44px); bottom: 74px; z-index: 60; white-space: nowrap; }
.slot { position: relative; transition: transform .18s ease, margin .2s ease; }
@media (hover: hover) { .slot:hover { transform: translateY(-46px); z-index: 50 !important; } }
.tilt { position: relative; transform-origin: 50% 130%; transition: transform .2s ease; }
.next {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  white-space: nowrap;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 1px 8px;
  border-radius: 999px;
  border: 2px solid var(--ink);
}
/* The front card can't be planted right now, so its tag stops shouting. */
.next.waiting { background: var(--panel-dark); color: var(--ink); }
.grabbable { cursor: grab; }
.grabbable:active { cursor: grabbing; }
/* The card left behind fades while its copy is carried to a field. */
.slot.dragging { opacity: .45; }
.slot.dragging .next { visibility: hidden; }
.empty { font-size: 13px; color: #fff6dc; padding-bottom: 80px; }

/* Phones: smaller cards, and the swap button tucked above the fan's left end. */
@media (orientation: portrait) and (max-width: 700px), (orientation: landscape) and (max-height: 500px) {
  .hand { padding: 26px 8px 0; margin-bottom: -44px; min-height: 100px; }
  /* At the end away from the front card, clear of its Plant next tag. */
  .swap { right: 0; bottom: calc(100% - 4px); padding: 3px 10px; font-size: 11px; }
  .swap.front-right { right: auto; left: 0; }
  .empty { padding-bottom: 50px; }
}
</style>
