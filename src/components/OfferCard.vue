<script setup lang="ts">
import { computed } from "vue"
import BeanCard from "./BeanCard.vue"
import type { BeanKey, BeanType, Offer } from "../types"

const props = defineProps<{
  offer: Offer
  fromName: string
  avatar: string
  beanTypes: Record<string, BeanType>
  // You hold every bean the bot asks for, so accepting can work.
  canAccept: boolean
  // Your hand, to tell which of the offer's choices you can give.
  hand: BeanKey[]
  busy: boolean
}>()

// bid: turn this deal down to make your own offers to the bot instead.
const emit = defineEmits<{ accept: [bean?: BeanKey]; decline: []; bid: [] }>()

const hasChoices = computed(() => props.offer.choices.length > 0)
const canGiveAny = computed(() => props.offer.choices.some((bean) => props.hand.includes(bean)))
</script>

<template>
  <div
    class="offer panel"
    role="dialog"
    aria-label="Trade offer"
  >
    <div class="from">
      <img
        :src="`/bots/${avatar}.webp`"
        alt=""
      >
      <div>
        <strong>{{ fromName }} wants to trade</strong>
        <!-- Under the title, not its own row, so the card fits beside your fields.
             Missing beans matter more than the planting reminder, so they take its place. -->
        <p
          v-if="hasChoices ? !canGiveAny : !canAccept"
          class="missing"
        >
          You don't have the beans {{ fromName }} asked for.
        </p>
        <p
          v-else
          class="hint"
        >
          Traded cards must be planted this turn.
        </p>
      </div>
    </div>

    <div class="deal">
      <div class="side">
        <span>You get</span>
        <div class="cards">
          <template
            v-for="(bean, index) in offer.give"
            :key="`give-${index}`"
          >
            <BeanCard
              v-if="beanTypes[bean]"
              :bean="beanTypes[bean]!"
            />
          </template>
          <span
            v-if="!offer.give.length"
            class="muted"
          >Nothing</span>
        </div>
      </div>
      <div class="arrow">
        ⇄
      </div>
      <!-- Any one of these: each card is its own Give button, greyed out when you have none. -->
      <div
        v-if="hasChoices"
        class="side"
      >
        <span>You give one of</span>
        <div class="cards">
          <button
            v-for="bean in offer.choices"
            :key="bean"
            class="choice"
            :disabled="busy || !hand.includes(bean)"
            :title="hand.includes(bean) ? '' : `You have no ${beanTypes[bean]?.name ?? bean}`"
            :aria-label="`Give ${beanTypes[bean]?.name ?? bean}`"
            @click="emit('accept', bean)"
          >
            <BeanCard
              v-if="beanTypes[bean]"
              :bean="beanTypes[bean]!"
            />
            <!-- The card above names the bean, so the button stays one short word. -->
            <span class="give">Give</span>
          </button>
        </div>
      </div>
      <div
        v-else
        class="side"
      >
        <span>You give</span>
        <div class="cards">
          <template
            v-for="(bean, index) in offer.ask"
            :key="`ask-${index}`"
          >
            <BeanCard
              v-if="beanTypes[bean]"
              :bean="beanTypes[bean]!"
            />
          </template>
          <span
            v-if="!offer.ask.length"
            class="muted"
          >Nothing, it's a gift</span>
        </div>
      </div>
    </div>

    <div class="buttons">
      <button
        class="secondary reach"
        :disabled="busy"
        @click="emit('decline')"
      >
        No thanks
      </button>
      <button
        class="secondary reach"
        :disabled="busy"
        @click="emit('bid')"
      >
        Make my own offer
      </button>
      <button
        v-if="!hasChoices"
        class="reach"
        :disabled="busy || !canAccept"
        @click="emit('accept')"
      >
        Deal!
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Sits beside your fields like the trade bar, so it matches its size and shadow. */
.offer { width: min(500px, 100%); display: grid; gap: 8px; padding: 12px 14px; box-shadow: 0 10px 24px rgba(0, 0, 0, .4); animation: offer-in .35s var(--ease-bounce); }
@keyframes offer-in { from { opacity: 0; transform: translateY(14px) scale(.96); } }
.from { display: flex; align-items: center; gap: 10px; font-family: "Fraunces", serif; font-size: 20px; }
.from .hint, .from .missing { margin-top: 2px; font-family: "Plus Jakarta Sans", sans-serif; font-size: 12px; text-align: left; }
.from img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold); }
.deal { display: flex; align-items: center; justify-content: center; gap: 14px; }
.side { display: grid; justify-items: center; gap: 6px; font-weight: 800; font-size: 13px; }
.cards { display: flex; gap: 6px; min-height: 120px; align-items: center; }
.arrow { font-size: 28px; color: var(--muted); }
.missing { margin: 0; color: var(--accent); font-weight: 800; text-align: center; }
.hint { margin: 0; font-size: 12px; color: var(--muted); text-align: center; }
.muted { color: var(--muted); font-size: 13px; }
.choice { display: grid; justify-items: center; gap: 4px; padding: 2px; background: none; box-shadow: none; border-radius: 12px; transition: transform .15s ease; }
.choice:not(:disabled):hover { transform: translateY(-3px); }
.choice:disabled { opacity: .4; filter: grayscale(.6); }
.give { padding: 3px 10px; border-radius: 999px; background: var(--gold); color: var(--ink); font-size: 12px; font-weight: 800; border: 2px solid var(--ink); }
.buttons { display: flex; justify-content: center; gap: 10px; }

@media (orientation: portrait) and (max-width: 1024px), (orientation: landscape) and (max-height: 500px) {
  .offer { gap: 6px; padding: 10px; }
  .from { gap: 8px; font-size: 16px; }
  .from img { width: 34px; height: 34px; }
  .deal { gap: 8px; }
  .side { font-size: 12px; }
  .cards { min-height: 0; gap: 4px; flex-wrap: wrap; justify-content: center; }
  .arrow { font-size: 22px; }
  .give { padding: 2px 8px; font-size: 11px; }
  .buttons { flex-wrap: wrap; gap: 6px; }
  .buttons button { flex: 1; padding: 6px 10px; font-size: 13px; white-space: nowrap; }
}

/* On its side the offer gets a narrow column, so the cards shrink to keep the deal on one row and the buttons in reach. */
@media (orientation: landscape) and (max-height: 500px) {
  .offer { padding: 8px; gap: 4px; }
  .from { font-size: 14px; }
  .from .hint { font-size: 10px; }
  .from img { width: 28px; height: 28px; }
  .cards { flex-wrap: nowrap; }
  .cards :deep(.card.small) { width: 52px; }
  .arrow { font-size: 18px; }
  .buttons button { padding: 5px 8px; font-size: 12px; }
}
</style>
