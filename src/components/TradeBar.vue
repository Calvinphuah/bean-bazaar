<script setup lang="ts">
import { computed } from "vue"
import type { BeanKey, BeanType, TradeGive } from "../types"

const props = defineProps<{
  gives: TradeGive[]
  // Beans asked for, with how many of each.
  asks: Record<BeanKey, number>
  beanTypes: Record<string, BeanType>
  status: string
  busy: boolean
  // The bot you are bidding to on its turn: its face-up cards are then yours to get.
  bidWith: string | null
}>()

// point: the bean under the pointer, so the table can show it big; null when it leaves.
const emit = defineEmits<{
  ask: [bean: BeanKey, change: number]
  remove: [give: TradeGive]
  point: [bean: BeanKey | null]
  clear: []
  done: []
}>()

const beans = computed(() => Object.values(props.beanTypes))

// One chip per bean with a count, so giving 10 or 20 cards still fits one row.
// A click takes back the card of that bean picked last.
function grouped(cards: TradeGive[]) {
  const groups = new Map<BeanKey, TradeGive[]>()
  for (const card of cards) groups.set(card.bean, [...(groups.get(card.bean) ?? []), card])
  return [...groups].map(([bean, picks]) => ({ bean, cards: picks, last: picks[picks.length - 1]! }))
}
// While bidding, picked face-up cards are the bot's, so they go under You get.
const giveGroups = computed(() => grouped(props.bidWith ? props.gives.filter((give) => give.source === "hand") : props.gives))
// What you get, per bean: beans asked for plus, while bidding, the bot's
// face-up cards you picked, so both light up the same way in one row.
const getCounts = computed(() => {
  const counts: Record<BeanKey, number> = { ...props.asks }
  if (props.bidWith) props.gives.filter((give) => give.source === "face_up").forEach((give) => { counts[give.bean] = (counts[give.bean] ?? 0) + 1 })
  return counts
})
const hasOffer = computed(() => props.gives.length > 0 || Object.keys(props.asks).length > 0)
</script>

<template>
  <div
    class="trade panel"
    data-tour="trade"
    :style="{ '--beans': beans.length }"
  >
    <div class="section">
      <h3>You give</h3>
      <div class="chips">
        <button
          v-for="group in giveGroups"
          :key="group.bean"
          class="chip-button card-button"
          :title="`Take back a ${beanTypes[group.bean]?.name} Bean`"
          :aria-label="`Take back a ${beanTypes[group.bean]?.name} Bean, ${group.cards.length} given`"
          @click="emit('remove', group.last); if (group.cards.length === 1) emit('point', null)"
          @mouseenter="emit('point', group.bean)"
          @mouseleave="emit('point', null)"
        >
          <img
            class="chip"
            :src="`/cards/${group.bean}-240.webp`"
            alt=""
          >
          <span
            v-if="group.cards.length > 1"
            class="ask-count"
          >{{ group.cards.length }}</span>
        </button>
        <span
          v-if="!giveGroups.length"
          class="hint"
        >{{ bidWith ? "Pick cards from your hand" : "Pick cards from the table or your hand" }}</span>
      </div>
    </div>

    <div class="section">
      <h3>{{ bidWith ? `You get from ${bidWith}` : "You get" }}</h3>
      <div class="asks">
        <div
          v-for="bean in beans"
          :key="bean.key"
          class="ask-slot"
        >
          <button
            class="ask card-button"
            :class="{ chosen: (getCounts[bean.key] ?? 0) > 0 }"
            :title="`${bean.name} Bean: right-click or press − to ask for one less`"
            :aria-label="`Ask for a ${bean.name} bean${getCounts[bean.key] ? `, ${getCounts[bean.key]} asked` : ''}`"
            @click="emit('ask', bean.key, 1)"
            @contextmenu.prevent="emit('ask', bean.key, -1)"
            @mouseenter="emit('point', bean.key)"
            @mouseleave="emit('point', null)"
          >
            <img
              :src="`/cards/${bean.key}-240.webp`"
              alt=""
            >
            <span class="ask-name">{{ bean.name }}</span>
            <span
              v-if="getCounts[bean.key]"
              class="ask-count"
            >{{ getCounts[bean.key] }}</span>
          </button>
          <!-- Right-click needs a mouse; this works for touch and keyboard too. -->
          <button
            v-if="asks[bean.key]"
            class="less"
            :aria-label="`Ask for one less ${bean.name} bean`"
            @click="emit('ask', bean.key, -1)"
          >
            −
          </button>
        </div>
      </div>
    </div>

    <div class="footer">
      <p
        class="status"
        aria-live="polite"
      >
        {{ status }}
      </p>

      <div class="buttons">
        <button
          class="small secondary"
          :disabled="busy || !hasOffer"
          @click="emit('clear')"
        >
          Clear
        </button>
        <button
          :disabled="busy"
          @click="emit('done')"
        >
          {{ bidWith ? "Done" : "Done trading" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* One 50px column per bean in this game: 8 beans, or 10 at a 5-player table. */
.trade { width: calc(var(--beans) * 50px + 24px); display: grid; gap: 6px; padding: 10px 12px; box-shadow: 0 10px 24px rgba(0, 0, 0, .4); }
.section { display: grid; gap: 5px; }
h3 { font-size: 14px; }
.hint { font-family: "Plus Jakarta Sans", sans-serif; font-size: 11px; font-weight: 500; color: var(--muted); }
/* Same columns as the asks below, so both rows line up. */
.chips { display: grid; grid-template-columns: repeat(var(--beans), 1fr); gap: 2px; min-height: 50px; padding-top: 4px; align-items: center; justify-items: center; }
.chips > .hint { grid-column: 1 / -1; justify-self: start; }
.chip-button { position: relative; padding: 3px; transition: transform .15s ease; }
.chip-button:hover { transform: translateY(-2px); }
.chip { display: block; width: 32px; aspect-ratio: 63 / 88; object-fit: cover; border-radius: 4px; border: 2px solid var(--ink); }
.asks { display: grid; grid-template-columns: repeat(var(--beans), 1fr); gap: 2px; }
.ask-slot { position: relative; display: grid; }
.less {
  position: absolute;
  top: -4px;
  left: 2px;
  width: 18px;
  height: 18px;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  line-height: 1;
  background: var(--panel);
  box-shadow: none;
}
.ask { position: relative; display: grid; justify-items: center; gap: 2px; padding: 3px; border-radius: 8px; transition: background .15s ease; }
.ask:hover { background: var(--panel-dark); }
.ask.chosen { background: #cfe9c5; }
.ask img { width: 32px; aspect-ratio: 63 / 88; object-fit: cover; border-radius: 4px; border: 2px solid var(--ink); }
.ask-name { font-size: 9px; font-weight: 800; white-space: nowrap; }
.ask-count {
  position: absolute;
  top: -4px;
  right: 6px;
  background: var(--ok);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 0 5px;
}
.footer { display: flex; gap: 8px; align-items: center; }
.status { margin: 0; flex: 1; font-size: 12px; font-weight: 800; line-height: 1.3; }
.buttons { display: flex; gap: 6px; flex: none; }
</style>
