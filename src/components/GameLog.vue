<script setup lang="ts">
import { computed } from "vue"
import { addressYou } from "../rules"
import type { LogEvent } from "../types"

const props = defineProps<{
  entries: LogEvent[]
  you: string
}>()

const emit = defineEmits<{ close: [] }>()

const newestFirst = computed(() =>
  [...props.entries].reverse().map((entry) => ({ ...entry, text: addressYou(entry.text, props.you) })),
)
</script>

<template>
  <aside class="panel log">
    <div class="header">
      <h3>Game log</h3>
      <button
        class="small secondary"
        aria-label="Close the log"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>
    <ol aria-live="polite">
      <li
        v-for="entry in newestFirst"
        :key="entry.seq"
        :class="[entry.type, { mine: entry.text.startsWith(you) || entry.text === 'Your turn' }]"
      >
        {{ entry.text }}
      </li>
      <li
        v-if="!entries.length"
        class="muted"
      >
        Moves will appear here.
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.log { width: 300px; max-height: 70vh; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 18px 40px rgba(0, 0, 0, .55); }
.header { display: flex; justify-content: space-between; align-items: center; }
ol { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: grid; gap: 3px; font-size: 13px; }
li { padding: 3px 6px; border-radius: 6px; line-height: 1.35; }
li.turn, li.game_over { font-weight: 800; background: var(--panel-dark); margin-top: 6px; }
li.harvest { color: var(--ok); }
li.offer, li.trade { color: #6a3a8c; }
li.mine { color: var(--accent); font-weight: 700; }
.muted { color: var(--muted); }
</style>
