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
      <strong>{{ fromName }} wants to trade</strong>
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

    <p
      v-if="hasChoices ? !canGiveAny : !canAccept"
      class="missing"
    >
      You don't have the beans {{ fromName }} asked for.
    </p>
    <p class="hint">
      Traded cards must be planted this turn.
    </p>

    <div class="buttons">
      <button
        class="secondary"
        :disabled="busy"
        @click="emit('decline')"
      >
        No thanks
      </button>
      <button
        class="secondary"
        :disabled="busy"
        @click="emit('bid')"
      >
        Make my own offer
      </button>
      <button
        v-if="!hasChoices"
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
.offer { width: min(500px, 100%); display: grid; gap: 10px; padding: 14px; box-shadow: 0 10px 24px rgba(0, 0, 0, .4); animation: offer-in .35s var(--ease-bounce); }
@keyframes offer-in { from { opacity: 0; transform: translateY(14px) scale(.96); } }
.from { display: flex; align-items: center; gap: 10px; font-family: "Fraunces", serif; font-size: 20px; }
.from img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold); }
.deal { display: flex; align-items: center; justify-content: center; gap: 14px; }
.side { display: grid; justify-items: center; gap: 6px; font-weight: 800; font-size: 13px; }
.cards { display: flex; gap: 6px; min-height: 120px; align-items: center; }
.arrow { font-size: 28px; color: var(--muted); }
.missing { margin: 0; color: var(--accent); font-weight: 800; text-align: center; }
.hint { margin: 0; font-size: 12px; color: var(--muted); text-align: center; }
.muted { color: var(--muted); font-size: 13px; }
.choice { display: grid; justify-items: center; gap: 6px; padding: 4px; background: none; box-shadow: none; border-radius: 12px; transition: transform .15s ease; }
.choice:not(:disabled):hover { transform: translateY(-3px); }
.choice:disabled { opacity: .4; filter: grayscale(.6); }
.give { padding: 3px 10px; border-radius: 999px; background: var(--gold); color: var(--ink); font-size: 12px; font-weight: 800; border: 2px solid var(--ink); }
.buttons { display: flex; justify-content: center; gap: 10px; }
</style>
