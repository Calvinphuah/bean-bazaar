<script setup lang="ts">
import { ref } from "vue"
import BrandMark from "./BrandMark.vue"
import type { BotLevel } from "../types"

defineProps<{ busy: boolean }>()

const emit = defineEmits<{ start: [botCount: number, botLevel: BotLevel]; tutorial: [] }>()

const botCount = ref(3)
const botLevel = ref<BotLevel>("normal")

const LEVELS: { level: BotLevel; label: string; hint: string }[] = [
  { level: "easy", label: "Easy", hint: "Bots plant and trade by simple rules." },
  { level: "normal", label: "Normal", hint: "Bots plan ahead and offer you deals, but go easy on each other." },
  { level: "smart", label: "Smart", hint: "Bots plan ahead, deal hard with each other, and watch who's winning." },
]
</script>

<template>
  <section class="start">
    <div
      class="fan"
      aria-hidden="true"
    >
      <img
        v-for="bean in ['blue', 'chili', 'stink', 'green', 'soy']"
        :key="bean"
        :src="`/cards/${bean}.webp`"
        alt=""
      >
    </div>

    <div class="panel intro">
      <h1 class="title">
        <BrandMark size="medium" />
      </h1>
      <p class="tagline">
        Plant beans, haggle at the table, and harvest your way to the most coins.
      </p>

      <div class="option">
        <span class="label">Opponents</span>
        <div class="segments">
          <button
            v-for="count in [2, 3, 4]"
            :key="count"
            class="segment"
            :aria-pressed="count === botCount"
            @click="botCount = count"
          >
            {{ count }} bots
          </button>
        </div>
      </div>

      <div class="option">
        <span class="label">Bots</span>
        <div class="segments">
          <button
            v-for="choice in LEVELS"
            :key="choice.level"
            class="segment"
            :aria-pressed="choice.level === botLevel"
            @click="botLevel = choice.level"
          >
            {{ choice.label }}
          </button>
        </div>
        <span class="hint">{{ LEVELS.find((choice) => choice.level === botLevel)?.hint }}</span>
      </div>

      <div class="actions">
        <button
          class="big"
          :disabled="busy"
          @click="emit('start', botCount, botLevel)"
        >
          {{ busy ? "Dealing..." : "Deal me in" }}
        </button>
        <button
          class="secondary"
          @click="emit('tutorial')"
        >
          How to play
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.start { min-height: 100vh; display: flex; gap: 56px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 24px 16px; }
.fan { position: relative; width: 320px; height: 300px; }
.fan img {
  position: absolute;
  left: 95px;
  top: 30px;
  width: 140px;
  border-radius: 12px;
  border: 5px solid #fff;
  box-shadow: 0 14px 26px -10px rgba(0, 0, 0, .85);
  transform-origin: 50% 125%;
  animation: deal .6s ease backwards;
}
.fan img:nth-child(1) { transform: rotate(-26deg); animation-delay: .05s; }
.fan img:nth-child(2) { transform: rotate(-13deg); animation-delay: .12s; }
.fan img:nth-child(3) { transform: rotate(0deg); animation-delay: .19s; }
.fan img:nth-child(4) { transform: rotate(13deg); animation-delay: .26s; }
.fan img:nth-child(5) { transform: rotate(26deg); animation-delay: .33s; }
@keyframes deal { from { opacity: 0; translate: 0 60px; } }

.intro { width: min(480px, 100%); display: grid; gap: 16px; padding: 26px; }
.title { margin-bottom: 4px; }
.tagline { margin: -6px 0 0; font-size: 16px; line-height: 1.5; }
.option { display: grid; gap: 8px; }
.label { font-weight: 800; font-size: 14px; }
/* One control per choice, so only the picked option looks pressed. */
.segments { justify-self: start; display: flex; border: 2px solid var(--ink); border-radius: 999px; overflow: hidden; box-shadow: 0 2px 0 var(--ink); }
.segment { border: 0; border-radius: 0; box-shadow: none; padding: 6px 14px; background: var(--panel); }
.segment + .segment { border-left: 2px solid var(--ink); }
.segment[aria-pressed="true"] { background: var(--gold); }
.segment:hover:not(:disabled), .segment:active:not(:disabled) { transform: none; }
.segment:hover:not([aria-pressed="true"]) { background: var(--panel-dark); }
.segment:focus-visible { outline: 3px solid var(--accent); outline-offset: -5px; }
.hint { font-size: 13px; color: var(--muted); }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
</style>
