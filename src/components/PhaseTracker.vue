<script setup lang="ts">
import { computed } from "vue"
import type { Phase } from "../types"

const props = defineProps<{
  phase: Phase
  turnLabel: string
}>()

const STEPS = [
  { key: "plant", label: "Plant" },
  { key: "trade", label: "Trade" },
  { key: "plant_pending", label: "Plant trades" },
  { key: "draw", label: "Draw 3" },
] as const

const currentStep = computed(() =>
  props.phase === "over" ? STEPS.length : STEPS.findIndex((step) => step.key === props.phase),
)
</script>

<template>
  <div class="tracker">
    <span class="turn">{{ turnLabel }}</span>
    <ol>
      <li
        v-for="(step, index) in STEPS"
        :key="step.key"
        :class="{ done: index < currentStep, current: index === currentStep }"
        :aria-current="index === currentStep ? 'step' : undefined"
      >
        <span class="dot">{{ index + 1 }}</span>
        {{ step.label }}
      </li>
    </ol>
  </div>
</template>

<style scoped>
.tracker { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.turn {
  background: var(--gold);
  color: var(--ink);
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 3px 12px;
  font-weight: 800;
  font-size: 14px;
}
ol { display: flex; gap: 6px; list-style: none; margin: 0; padding: 0; flex-wrap: wrap; }
li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  font-size: 13px;
  color: rgba(246, 239, 227, .55);
  background: rgba(0, 0, 0, .2);
}
.dot {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
  background: rgba(246, 239, 227, .15);
}
li.done { color: rgba(246, 239, 227, .8); }
li.done .dot { background: var(--ok); color: #fff; }
li.current { color: var(--ink); background: var(--panel); font-weight: 800; }
li.current .dot { background: var(--accent); color: #fff; }
</style>
