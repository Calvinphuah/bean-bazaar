<script setup lang="ts">
import { computed } from "vue"
import type { BeanType } from "../types"

const props = withDefaults(defineProps<{
  bean: BeanType
  size?: "mini" | "small" | "medium" | "large" | "full"
  selected?: boolean
  highlighted?: boolean
}>(), { size: "small", selected: false, highlighted: false })

// Shrinking the 480px art ~5x in the browser looks soft, so every size but
// full uses a copy pre-shrunk and sharpened to 240px (sharp on 2x screens too).
const artSrc = computed(() => `/cards/${props.bean.key}${props.size === "full" ? "" : "-240"}.webp`)

// Coin stacks for 1..4 coins, skipping steps this bean doesn't pay.
const stacks = computed(() =>
  [1, 2, 3, 4].flatMap((coins) => {
    const beans = props.bean.meter[String(coins)]
    return beans === undefined ? [] : [{ coins, beans }]
  }),
)
</script>

<template>
  <div
    class="card"
    :class="[size, { selected, highlighted }]"
  >
    <div class="art">
      <img
        :src="artSrc"
        :alt="`${bean.name} Bean`"
        draggable="false"
      >
      <div
        v-if="size !== 'mini'"
        class="name"
      >
        {{ bean.name }} Bean
      </div>
      <div
        v-if="size !== 'mini'"
        class="count"
      >
        {{ bean.copies }}
      </div>
    </div>
    <div
      v-if="size === 'full' || size === 'medium'"
      class="meter"
    >
      <div
        v-for="stack in stacks"
        :key="stack.coins"
        class="slot"
      >
        <div class="stack">
          <img
            v-for="coin in stack.coins"
            :key="coin"
            src="/cards/coin.webp"
            alt=""
            draggable="false"
            :style="{ bottom: `${(coin - 1) * 4}px` }"
          >
        </div>
        <div class="beans">
          {{ stack.beans }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  aspect-ratio: 63 / 88;
  background: #fff;
  border-radius: 9px;
  padding: 3px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 6px 12px -6px rgba(0, 0, 0, .75);
  transition: transform .18s ease, box-shadow .18s ease;
  user-select: none;
}
.card.mini { width: 38px; border-radius: 5px; padding: 2px; }
.card.small { width: 92px; }
.card.medium { width: 112px; padding: 4px; }
.card.large { width: 132px; padding: 4px; border-radius: 11px; }
.card.full { width: 190px; padding: 6px; border-radius: 14px; }
.card.selected { transform: translateY(-12px); box-shadow: 0 0 0 4px var(--gold), 0 12px 20px -8px rgba(0, 0, 0, .85); }
.card.highlighted { box-shadow: 0 0 0 4px var(--accent), 0 0 24px 4px rgba(246, 201, 56, .55); }

.art {
  position: relative;
  flex: 1;
  border: 2px solid var(--ink);
  border-radius: 6px;
  overflow: hidden;
}
.mini .art { border-width: 1px; border-radius: 3px; }
.art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.name, .count {
  position: absolute;
  font-family: "Fraunces", serif;
  font-weight: 900;
  color: var(--gold);
  -webkit-text-stroke: 3px var(--ink);
  paint-order: stroke fill;
  line-height: 1;
}
.name { top: 5px; left: 5px; right: 5px; font-size: 10px; text-transform: uppercase; }
.count { bottom: 4px; right: 6px; font-size: 20px; }
.medium .name { font-size: 11px; }
.medium .count { font-size: 22px; }
.large .name { font-size: 12px; top: 7px; left: 7px; }
.large .count { font-size: 26px; -webkit-text-stroke-width: 4px; }
.full .name { font-size: 15px; top: 7px; left: 8px; -webkit-text-stroke-width: 4px; }
.full .count { font-size: 32px; bottom: 6px; right: 9px; -webkit-text-stroke-width: 5px; }

.meter {
  display: flex;
  justify-content: space-evenly;
  align-items: flex-end;
  margin-top: 3px;
  padding: 2px 1px;
  border: 2px solid var(--ink);
  border-radius: 3px 3px 6px 6px;
  background: var(--panel);
}
.slot { display: flex; flex-direction: column; align-items: center; gap: 1px; width: 25%; }
/* Tall enough for 4 coins: 3 steps of 4px plus one coin, with a little air on top. */
.stack { position: relative; width: 16px; height: 29px; }
.stack img { position: absolute; left: 0; width: 16px; }
.beans { font-family: "Fraunces", serif; font-weight: 900; font-size: 10px; line-height: 1; color: var(--ink); }
.full .meter { margin-top: 5px; padding: 7px 2px 3px; }
.full .stack { width: 26px; height: 40px; }
.full .stack img { width: 26px; }
.full .beans { font-size: 14px; }
</style>
