<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue"
import type { BeanKey, BeanType, LogEvent } from "../types"

const props = defineProps<{
  // The move being replayed; each one may set off an effect.
  event: LogEvent | null
  playerNames: string[]
  beanTypes: Record<string, BeanType>
}>()

// A coin or card flying across the table, its path worked out once at launch.
interface Flyer {
  id: number
  src: string
  kind: "coin" | "card"
  style: Record<string, string>
}

const COINS_PER_COIN = 3
const MAX_COINS = 18
const FLIGHT_MS = 650
const COIN_STAGGER_MS = 45
const CARD_STAGGER_MS = 120

const flyers = ref<Flyer[]>([])
let nextId = 0
const timers = new Set<ReturnType<typeof setTimeout>>()

function later(run: () => void, delay: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    run()
  }, delay)
  timers.add(timer)
}

onBeforeUnmount(() => timers.forEach(clearTimeout))

// Plates and fields mark themselves with data-anchor="plate-2" and so on.
function anchor(part: "plate" | "fields", player: number): DOMRect | null {
  return document.querySelector(`[data-anchor="${part}-${player}"]`)?.getBoundingClientRect() ?? null
}

function launch(src: string, kind: Flyer["kind"], from: DOMRect | null, to: DOMRect | null, count: number, stagger: number): void {
  if (!from || !to) return
  const added = Array.from({ length: count }, (_, index) => ({ id: nextId++, src, kind, style: flightPath(kind, from, to, index * stagger) }))
  flyers.value = [...flyers.value, ...added]
  const done = new Set(added.map((flyer) => flyer.id))
  later(() => { flyers.value = flyers.value.filter((flyer) => !done.has(flyer.id)) }, FLIGHT_MS + count * stagger + 100)
}

// "Pinto harvested 5 Blue for 2 coins" and "Lima earned 3 coins in the final harvest".
function coinsIn(text: string): number {
  return Number(/(?:for|earned) (\d+) coins?/.exec(text)?.[1] ?? 0)
}

function beanKey(name: string): BeanKey | undefined {
  return Object.values(props.beanTypes).find((bean) => bean.name === name)?.key
}

// "A traded Red and Soy to B for Blue", "A gave Red to B", "B gave Soy to A".
function trade(text: string): void {
  const match = /^(.+?) (?:traded|gave) (.+?) to (.+?)(?: for (.+))?$/.exec(text)
  if (!match) return
  const [, giver = "", gives = "", taker = "", gets] = match
  const giverIndex = props.playerNames.indexOf(giver)
  const takerIndex = props.playerNames.indexOf(taker)
  if (giverIndex === -1 || takerIndex === -1) return
  fly(gives, anchor("plate", giverIndex), anchor("plate", takerIndex))
  if (gets) fly(gets, anchor("plate", takerIndex), anchor("plate", giverIndex))
}

function fly(beanNames: string, from: DOMRect | null, to: DOMRect | null): void {
  beanNames.split(" and ").forEach((name, index) => {
    const key = beanKey(name)
    if (key) later(() => launch(`/cards/${key}-240.webp`, "card", from, to, 1, 0), index * CARD_STAGGER_MS)
  })
}

watch(() => props.event, (event) => {
  if (!event || event.player === null) return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  if (event.type === "harvest" || event.type === "final_harvest") {
    const coins = coinsIn(event.text)
    if (coins > 0) {
      launch("/cards/coin.webp", "coin", anchor("fields", event.player), anchor("plate", event.player), Math.min(coins * COINS_PER_COIN, MAX_COINS), COIN_STAGGER_MS)
    }
  } else if (event.type === "trade") {
    trade(event.text)
  }
})

// Coins start at a random spot over the field; each flyer arcs up and over into its target.
function flightPath(kind: Flyer["kind"], from: DOMRect, to: DOMRect, delay: number): Record<string, string> {
  const spread = kind === "coin" ? 0.6 : 0
  const startX = from.left + from.width * (0.5 + (Math.random() - 0.5) * spread)
  const startY = from.top + from.height * 0.4
  const endX = to.left + to.width * 0.2
  const endY = to.top + to.height * 0.5
  return {
    left: `${startX}px`,
    top: `${startY}px`,
    "--dx": `${endX - startX}px`,
    "--dy": `${endY - startY}px`,
    "--lift": `${-60 - Math.random() * 50}px`,
    "--spin": `${(Math.random() - 0.5) * 720}deg`,
    animationDelay: `${delay}ms`,
    animationDuration: `${FLIGHT_MS}ms`,
  }
}
</script>

<template>
  <div
    class="effects"
    aria-hidden="true"
  >
    <img
      v-for="flyer in flyers"
      :key="flyer.id"
      class="flyer"
      :class="flyer.kind"
      :src="flyer.src"
      alt=""
      :style="flyer.style"
    >
  </div>
</template>

<style scoped>
.effects { position: fixed; inset: 0; z-index: 25; pointer-events: none; overflow: hidden; }
.flyer { position: absolute; translate: -50% -50%; animation: arc ease-in-out both; }
.coin { width: 24px; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .45)); }
.card { width: 44px; border-radius: 4px; border: 2px solid #fff; box-shadow: 0 6px 12px rgba(0, 0, 0, .45); }
/* Up and over: rises to the arc's top halfway, then drops into the target. */
@keyframes arc {
  0% { transform: translate(0, 0) rotate(0) scale(.6); opacity: 0; }
  12% { opacity: 1; }
  50% { transform: translate(calc(var(--dx) * .5), calc(var(--dy) * .5 + var(--lift))) rotate(calc(var(--spin) * .5)) scale(1.1); }
  90% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--spin)) scale(.7); opacity: 0; }
}
</style>
