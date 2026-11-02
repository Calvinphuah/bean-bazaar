<script setup lang="ts">
import { computed, ref } from "vue"
import BeanCard from "./BeanCard.vue"
import { coinText, coinsFor, nextStep } from "../rules"
import type { BeanType, FieldState } from "../types"

const props = defineProps<{
  field: FieldState
  beanType: BeanType | null
  // Label for the plant button, e.g. "Plant Soy"; null when nothing can be planted here.
  plantLabel: string | null
  canHarvest: boolean
}>()

const emit = defineEmits<{ plant: []; harvest: [] }>()

// A few cards stand for the whole pile; the badge gives the exact count.
const MAX_LAYERS = 3
const LAYER_STEP = 5

// Each card further back sits a little higher and at its own slight angle, like a hand-stacked pile.
function layerStyle(layer: number): Record<string, string> {
  const angle = layer % 2 === 0 ? 2 : -2.5
  return { transform: `translateY(${-layer * LAYER_STEP}px) rotate(${angle}deg)`, zIndex: String(-layer) }
}

const dragOver = ref(false)
const coins = computed(() => coinsFor(props.beanType ?? undefined, props.field.count))
const next = computed(() => nextStep(props.beanType ?? undefined, props.field.count))

function onDrop(): void {
  dragOver.value = false
  if (props.plantLabel) emit("plant")
}
</script>

<template>
  <div
    class="field"
    :class="{ empty: beanType === null, droppable: !!plantLabel, over: dragOver, grown: !!beanType && !next }"
    @dragover.prevent="dragOver = !!plantLabel"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div
      v-if="beanType"
      class="pile"
    >
      <!-- The same card piled behind, name banners peeking out above, shows how full the field is. -->
      <div
        v-for="layer in Math.min(field.count - 1, MAX_LAYERS)"
        :key="layer"
        class="layer"
        :style="layerStyle(layer)"
        aria-hidden="true"
      >
        <BeanCard
          :bean="beanType"
          size="small"
        />
      </div>
      <!-- Keyed by the count, so each new bean lands on the pile and bumps the badge. -->
      <div
        :key="field.count"
        class="top"
      >
        <BeanCard
          :bean="beanType"
          size="small"
        />
      </div>
      <span
        :key="field.count"
        class="badge"
      >{{ field.count }}</span>
    </div>
    <div
      v-else
      class="placeholder"
    >
      Empty field
    </div>

    <div class="info">
      <template v-if="beanType">
        <strong v-if="coins">{{ coinText(coins) }}</strong>
        <span v-if="next">{{ next.beans - field.count }} more for {{ coinText(next.coins) }}</span>
        <span v-else>Fully grown, harvest it</span>
      </template>
    </div>

    <div class="actions">
      <!-- The instruction names the bean; the button just says where it goes. -->
      <button
        v-if="plantLabel"
        class="small"
        :aria-label="plantLabel"
        @click="emit('plant')"
      >
        Plant here
      </button>
      <button
        v-if="beanType"
        class="small secondary"
        :disabled="!canHarvest"
        :title="canHarvest ? '' : 'Harvest a field with more beans first'"
        @click="emit('harvest')"
      >
        Harvest
      </button>
    </div>
  </div>
</template>

<style scoped>
.field {
  width: 124px;
  min-height: 190px;
  padding: 8px 6px;
  border-radius: 14px;
  border: 2px dashed transparent;
  background: rgba(60, 30, 10, .22);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.field.empty { border-color: rgba(255, 246, 220, .4); }
.field.droppable { border-color: var(--gold); border-style: solid; box-shadow: 0 0 18px rgba(246, 201, 56, .5); }
.field.over { background: rgba(246, 201, 56, .2); transform: scale(1.04); }
/* A field at its top payout glows softly: time to sell. */
.field.grown { animation: ripe 2.4s ease-in-out infinite; }
@keyframes ripe { 50% { box-shadow: 0 0 22px rgba(246, 201, 56, .55); } }
.top { animation: land .45s var(--ease-bounce) both; }
@keyframes land {
  from { transform: translateY(-26px) rotate(-4deg) scale(1.06); opacity: .4; }
}
/* Room above each top card (and empty patch) for the banners behind it, so fields line up. */
.pile { position: relative; isolation: isolate; margin-top: 12px; }
/* Dimmed a touch, so the top card still reads first. */
.layer { position: absolute; inset: 0; filter: brightness(.88); }
.badge {
  position: absolute;
  animation: bump .35s var(--ease-bounce);
  top: -9px;
  right: -11px;
  min-width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: #fff;
  font-weight: 800;
  font-size: 15px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 0 6px;
}
@keyframes bump { 40% { transform: scale(1.35); } }
.placeholder {
  width: 92px;
  aspect-ratio: 63 / 88;
  margin-top: 12px;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 12px;
  color: #fff6dc;
}
.info { display: grid; justify-items: center; text-align: center; font-size: 11px; min-height: 30px; color: #fff6dc; text-shadow: 0 1px 0 rgba(0, 0, 0, .5); }
.info strong { font-size: 13px; color: #ffe27a; }
.actions { margin-top: auto; display: flex; flex-direction: column; gap: 5px; }
</style>
