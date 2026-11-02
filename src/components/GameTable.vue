<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from "vue"
import BeanCard from "./BeanCard.vue"
import BrandMark from "./BrandMark.vue"
import BeanField from "./BeanField.vue"
import BotSeat from "./BotSeat.vue"
import GameLog from "./GameLog.vue"
import OfferCard from "./OfferCard.vue"
import PhaseTracker from "./PhaseTracker.vue"
import PlayerHand from "./PlayerHand.vue"
import TableCenter from "./TableCenter.vue"
import TableEffects from "./TableEffects.vue"
import TradeBar from "./TradeBar.vue"
import TutorialGuide from "./TutorialGuide.vue"
import { MAX_FIELDS, MAX_HAND_PLANTS, THIRD_FIELD_PRICE, accepts, addressYou, canHarvest, coinText } from "../rules"
import { useRollingNumber } from "../useRollingNumber"
import { useTrade } from "../useTrade"
import type { BeanKey, BeanType, FieldState, GameState, LogEvent, Move, PlayerState, TableSnapshot } from "../types"

const props = defineProps<{
  game: GameState
  table: TableSnapshot
  busy: boolean
  replaying: LogEvent | null
  showTutorial: boolean
  soundOn: boolean
  move: (next: Move) => Promise<boolean>
}>()

const emit = defineEmits<{ leave: []; skip: []; tutorialDone: []; tutorial: []; toggleSound: [] }>()

// The table is laid out for this size; a smaller window gets the whole table
// scaled down to fit, never a squashed layout.
const TABLE_WIDTH = 1200
const TABLE_HEIGHT = 820
const scale = ref(1)

function fitTable(): void {
  scale.value = Math.min(1, window.innerWidth / TABLE_WIDTH, window.innerHeight / TABLE_HEIGHT)
}

onMounted(() => {
  fitTable()
  window.addEventListener("resize", fitTable)
})
onBeforeUnmount(() => window.removeEventListener("resize", fitTable))

// Seat spots around the table, clockwise from your left, by number of bots.
const SEAT_SPOTS: Record<number, string[]> = {
  2: ["top-left", "top-right"],
  3: ["left", "top", "right"],
  4: ["left", "top-left", "top-right", "right"],
}

const showLog = ref(false)
const showPayouts = ref(false)
const pickedPending = ref<number | null>(null)
// The bean under the pointer in your hand or the trade bar, shown big with its coin row.
const pointedBean = ref<BeanKey | null>(null)

const beanTypes = computed<Record<string, BeanType>>(() =>
  Object.fromEntries(props.game.bean_types.map((bean) => [bean.key, bean])),
)
const you = computed(() => props.game.you)
const me = computed(() => props.game.players[you.value])
const myTable = computed(() => props.table.players[you.value])
const hand = computed<BeanKey[]>(() => me.value?.hand ?? [])
const frontCard = computed(() => hand.value[0] ?? null)
const pointedType = computed(() => (pointedBean.value ? beanTypes.value[pointedBean.value] : undefined))
const pointedCopies = computed(() => hand.value.filter((bean) => bean === pointedBean.value).length)
const myFields = computed<FieldState[]>(() => myTable.value?.fields ?? [])
const myCoins = useRollingNumber(() => myTable.value?.coins ?? 0)

const seats = computed(() => {
  const count = props.game.players.length
  const spots = SEAT_SPOTS[count - 1] ?? []
  return Array.from({ length: count - 1 }, (_, offset) => {
    const index = (you.value + offset + 1) % count
    // Each bot's portrait is the bean it's named after, e.g. Pinto is /bots/pinto.webp.
    return { index, spot: spots[offset] ?? "top", avatar: nameOf(index).toLowerCase() }
  })
})
const avatarOf = (index: number): string => nameOf(index).toLowerCase()
const nameOf = (index: number | null): string => (index === null ? "" : props.game.players[index]?.name ?? "")

// Nothing is clickable while bot moves replay; the live state decides what you may do.
const live = computed(() => !props.replaying && !props.busy && !props.game.over)
const myTurn = computed(() => props.game.active_index === you.value && !props.game.over)
const canPlantFromHand = computed(() =>
  live.value && myTurn.value && props.game.phase === "plant" && props.game.hand_plants < MAX_HAND_PLANTS && frontCard.value !== null,
)
const canFlip = computed(() =>
  live.value && myTurn.value && props.game.phase === "plant" && (props.game.hand_plants > 0 || hand.value.length === 0),
)
const isTrading = computed(() => live.value && myTurn.value && props.game.phase === "trade" && !props.game.offer)
// On a bot's turn, after turning its offer down to make your own.
const isBidding = computed(() => live.value && props.game.bidding)
const isDealing = computed(() => isTrading.value || isBidding.value)
// The trade bar's buttons can vanish under the pointer, so its preview closes with it.
watch(isDealing, (dealing) => { if (!dealing) pointedBean.value = null })
// Not tied to `live`: the traded-beans panel stays up while each plant saves and
// replays, instead of blinking out; only the plant buttons wait for `live`.
const pendingIndex = computed(() => {
  const pending = me.value?.pending ?? []
  if (props.game.over || props.game.phase !== "plant_pending" || pending.length === 0) return null
  return pickedPending.value !== null && pickedPending.value < pending.length ? pickedPending.value : 0
})
const pendingCard = computed(() => (pendingIndex.value === null ? null : me.value?.pending[pendingIndex.value] ?? null))
// Beans you got in trades this turn: locked away from trading until they're planted.
const lockedPending = computed(() => (!props.replaying && props.game.phase === "trade" ? me.value?.pending ?? [] : []))
const lockedGroups = computed(() => groupBeans(lockedPending.value))
// Traded beans to plant, one card per bean with a count, so a big trade stays one row.
const pendingGroups = computed(() => groupBeans(me.value?.pending ?? []))

function groupBeans(beans: BeanKey[]): { bean: BeanKey; indexes: number[] }[] {
  const groups = new Map<BeanKey, number[]>()
  beans.forEach((bean, index) => groups.set(bean, [...(groups.get(bean) ?? []), index]))
  return [...groups].map(([bean, indexes]) => ({ bean, indexes }))
}
const pendingHint = computed(() => {
  const card = pendingCard.value
  if (!card) return ""
  if (!myFields.value.some((field) => accepts(field, card))) return `No field can take your ${beanName(card)}: harvest a field first.`
  return `Drag your ${beanName(card)} onto a field, or press Plant here.`
})
const canBuyField = computed(() =>
  live.value && !!me.value && me.value.fields.length < MAX_FIELDS && me.value.coins >= THIRD_FIELD_PRICE,
)

const offer = computed(() => (props.replaying ? null : props.game.offer))
const canAcceptOffer = computed(() => {
  const remaining = [...hand.value]
  return (offer.value?.ask ?? []).every((bean) => {
    const index = remaining.indexOf(bean)
    if (index === -1) return false
    remaining.splice(index, 1)
    return true
  })
})

const trade = useTrade(toRef(props, "game"), isDealing, isBidding, props.move)

watch(() => me.value?.pending.length, () => { pickedPending.value = null })

const turnLabel = computed(() => {
  if (props.game.over) return "Game over"
  return props.table.active_index === you.value ? "Your turn" : `${nameOf(props.table.active_index)}'s turn`
})

function beanName(bean: BeanKey): string {
  return beanTypes.value[bean]?.name ?? bean
}

// One clear instruction for what to do right now.
const instruction = computed(() => {
  // The traded-beans panel gives its own instructions, even mid-replay.
  if (pendingCard.value) return ""
  if (props.replaying) {
    if (props.replaying.player === you.value) return "Playing your move..."
    return `${nameOf(props.replaying.player) || "The table"} is playing...`
  }
  if (props.game.over) return ""
  if (offer.value) return `${nameOf(offer.value.from)} is offering you a deal.`
  if (isBidding.value) return `Make ${nameOf(props.game.active_index)} an offer for its cards, then press Done.`
  if (!myTurn.value) return `${nameOf(props.game.active_index)} is playing...`
  if (props.game.phase === "plant" && props.game.hand_plants === 0) {
    const card = frontCard.value
    if (!card) return "Your hand is empty, so flip 2 cards."
    if (!myFields.value.some((field) => accepts(field, card))) return `No field can take your ${beanName(card)}: harvest a field first.`
    return `Drag your ${beanName(card)} onto a field, or press Plant here.`
  }
  if (props.game.phase === "plant") return "Plant your next card too, or flip 2 cards to start trading."
  return "Trade the flipped cards, or press Done trading to keep them. You plant what you keep."
})

// A replayed move, minus the bot's own name, for its speech bubble.
function bubbleFor(index: number): string | null {
  const event = props.replaying
  if (!event || event.player !== index || event.type === "turn") return null
  const name = nameOf(index)
  const text = event.text.startsWith(`${name} `) ? event.text.slice(name.length + 1) : event.text
  return addressYou(text, nameOf(you.value))
}

// Making your own offer starts from the bot's: what it was giving you is
// already picked once the bid opens.
async function bidOn(beans: BeanKey[]): Promise<void> {
  trade.queuePicks(beans)
  if (!(await props.move({ type: "open_bids" }))) trade.queuePicks(null)
}

function plantLabel(field: FieldState): string | null {
  if (canPlantFromHand.value && frontCard.value && accepts(field, frontCard.value)) return `Plant ${beanName(frontCard.value)}`
  if (live.value && pendingCard.value && accepts(field, pendingCard.value)) return `Plant ${beanName(pendingCard.value)}`
  return null
}

function plantInto(fieldIndex: number): void {
  if (canPlantFromHand.value) props.move({ type: "plant_from_hand", field_index: fieldIndex })
  else if (pendingIndex.value !== null) {
    props.move({ type: "plant_pending", pending_index: pendingIndex.value, field_index: fieldIndex })
  }
}

// What each player's final harvest added, read off the coin counts around it in the log.
const finalHarvest = computed(() => {
  const log = props.game.log
  return Object.fromEntries(
    log.flatMap((event, at) => {
      const before = log[at - 1]
      if (event.type !== "final_harvest" || event.player === null || !before) return []
      const earned = (event.table.players[event.player]?.coins ?? 0) - (before.table.players[event.player]?.coins ?? 0)
      return [[event.player, earned]]
    }),
  ) as Record<number, number>
})

// Ranked like the winners: coins, then cards left in hand. Players level on both share a place.
const ahead = (left: PlayerState, right: PlayerState): boolean =>
  left.coins > right.coins || (left.coins === right.coins && left.hand_size > right.hand_size)
const standings = computed(() =>
  props.game.players
    .map((player, index) => ({
      index,
      name: player.name,
      coins: player.coins,
      handSize: player.hand_size,
      place: 1 + props.game.players.filter((other) => ahead(other, player)).length,
      winner: props.game.winners.includes(index),
      // Same coins as someone placed above, who kept more cards in hand.
      lostOnCards: props.game.players.some((other) => other.coins === player.coins && other.hand_size > player.hand_size),
      avatar: index === you.value ? null : avatarOf(index),
      finalHarvest: finalHarvest.value[index] ?? 0,
    }))
    .sort((left, right) => right.coins - left.coins || right.handSize - left.handSize),
)
const youWon = computed(() => props.game.winners.includes(you.value))
// Someone matched the winner's coins but lost on cards in hand, so say why.
const wonOnCards = computed(() => {
  const top = standings.value[0]
  return !!top && standings.value.some((entry) => !entry.winner && entry.coins === top.coins)
})
const myStanding = computed(() => standings.value.find((entry) => entry.index === you.value))
const winnerNames = computed(() => standings.value.filter((entry) => entry.winner).map((entry) => entry.name))
const resultTitle = computed(() => {
  if (youWon.value) return winnerNames.value.length > 1 ? "You share the win!" : "You win the bazaar!"
  return `${winnerNames.value.join(" and ")} ${winnerNames.value.length > 1 ? "share" : "wins"} the bazaar`
})
const resultLine = computed(() => {
  const mine = myStanding.value
  if (!mine) return ""
  const best = standings.value[0]?.coins ?? 0
  const runnerUp = standings.value.find((entry) => !entry.winner)?.coins ?? best
  if (youWon.value && winnerNames.value.length > 1) {
    return `Tied for first with ${winnerNames.value.filter((name) => name !== mine.name).join(" and ")}.`
  }
  if (youWon.value) return best > runnerUp ? `${coinText(best - runnerUp)} ahead of 2nd place.` : "Nobody could catch you."
  return `You came ${ordinal(mine.place)}, ${coinText(best - mine.coins)} behind.`
})
// Only a win gets the shower of coins.
const CONFETTI_PIECES = 18

function ordinal(place: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th"][place - 1] ?? `${place}th`
}
</script>

<template>
  <div
    class="game"
    :style="{ zoom: scale }"
  >
    <header class="topbar">
      <BrandMark size="small" />
      <PhaseTracker
        :phase="table.phase"
        :turn-label="turnLabel"
      />
      <div class="tools">
        <button
          class="tool"
          :aria-pressed="soundOn"
          :title="soundOn ? 'Turn the sound effects off' : 'Turn the sound effects on'"
          @click="emit('toggleSound')"
        >
          {{ soundOn ? "🔊 Sound" : "🔇 Sound" }}
        </button>
        <button
          class="tool"
          @click="emit('tutorial')"
        >
          Rules
        </button>
        <button
          class="tool"
          @click="showPayouts = true"
        >
          Payouts
        </button>
        <button
          class="tool"
          :aria-pressed="showLog"
          @click="showLog = !showLog"
        >
          Log
        </button>
        <button
          class="tool"
          @click="emit('leave')"
        >
          New game
        </button>
      </div>
    </header>

    <main
      class="felt"
      :class="`season-${Math.min(table.deck.run_outs + 1, 3)}`"
    >
      <BotSeat
        v-for="seat in seats"
        :key="seat.index"
        data-tour="seats"
        :seat-index="seat.index"
        :class="`spot-${seat.spot}`"
        :name="nameOf(seat.index)"
        :avatar="seat.avatar"
        :seat="table.players[seat.index]!"
        :bean-types="beanTypes"
        :active="table.active_index === seat.index && !game.over"
        :winner="game.over && game.winners.includes(seat.index)"
        :bubble="bubbleFor(seat.index)"
        :answer="isDealing ? trade.answers.value[seat.index] ?? null : null"
        :counter="isDealing ? trade.counters.value[seat.index] ?? null : null"
        :can-trade-with="isDealing && trade.answers.value[seat.index] === 'accept'"
        :gift="trade.isGift.value"
        :side="seat.spot === 'left' || seat.spot === 'right' ? seat.spot : 'top'"
        @trade="trade.tradeWith(seat.index)"
        @counter="trade.takeCounter(seat.index)"
      />

      <div class="middle">
        <TableCenter
          :table="table"
          :bean-types="beanTypes"
          :picked-face-up="trade.pickedFaceUp.value"
          :pickable="isDealing"
          @pick="trade.toggleFaceUp"
        />
      </div>

      <div class="row my-spot">
        <div class="farm-side">
          <div class="plate-row">
            <!-- Your plate matches the bots': who you are and what you've earned. -->
            <div
              class="my-plate"
              :class="{ active: myTurn && !replaying }"
              :data-anchor="`plate-${you}`"
            >
              <!-- Re-keyed on every coin, so the coin hops as the count ticks up. -->
              <img
                :key="myCoins.hop.value"
                class="coin-hop"
                src="/cards/coin.webp"
                alt=""
              >
              <strong>You</strong>
              <span>{{ coinText(myCoins.shown.value) }}</span>
            </div>
            <div
              v-if="lockedPending.length"
              class="locked"
            >
              <span>Plant after trading:</span>
              <template
                v-for="group in lockedGroups"
                :key="group.bean"
              >
                <span
                  v-if="beanTypes[group.bean]"
                  class="locked-card"
                >
                  <BeanCard
                    :bean="beanTypes[group.bean]!"
                    size="mini"
                  />
                  <span
                    v-if="group.indexes.length > 1"
                    class="group-count"
                  >{{ group.indexes.length }}</span>
                </span>
              </template>
            </div>
          </div>
          <div
            class="farm"
            data-tour="fields"
            :data-anchor="`fields-${you}`"
          >
            <BeanField
              v-for="(field, index) in myFields"
              :key="index"
              :field="field"
              :bean-type="field.bean ? beanTypes[field.bean] ?? null : null"
              :plant-label="live ? plantLabel(field) : null"
              :can-harvest="live && canHarvest(myFields, index)"
              @plant="plantInto(index)"
              @harvest="move({ type: 'harvest', field_index: index })"
            />
            <button
              v-if="canBuyField"
              class="buy-field"
              @click="move({ type: 'buy_third_field' })"
            >
              + Buy a 3rd field<br><small>{{ THIRD_FIELD_PRICE }} coins</small>
            </button>
          </div>
        </div>

        <div class="action">
          <!-- Beside your fields, not over them, so you can see what fits before answering. -->
          <OfferCard
            v-if="offer"
            :offer="offer"
            :from-name="nameOf(offer.from)"
            :avatar="avatarOf(offer.from)"
            :bean-types="beanTypes"
            :can-accept="canAcceptOffer"
            :hand="hand"
            :busy="busy"
            @accept="(bean) => move(bean ? { type: 'accept_offer', bean } : { type: 'accept_offer' })"
            @decline="move({ type: 'decline_offer' })"
            @bid="bidOn(offer.give)"
          />
          <TradeBar
            v-else-if="isDealing"
            :gives="trade.gives.value"
            :bid-with="isBidding ? nameOf(game.active_index) : null"
            :asks="trade.asks.value"
            :bean-types="beanTypes"
            :status="trade.status.value"
            :busy="busy"
            @ask="trade.changeAsk"
            @remove="trade.removeGive"
            @point="pointedBean = $event"
            @clear="trade.clear"
            @done="move({ type: isBidding ? 'close_bids' : 'end_trading' })"
          />
          <p
            v-else-if="instruction"
            class="instruction"
            :class="{ thinking: !!replaying }"
          >
            <span
              v-if="replaying || busy"
              class="spinner"
              aria-hidden="true"
            />
            {{ instruction }}
          </p>
          <div class="buttons">
            <button
              v-if="live && game.can_undo"
              class="secondary"
              title="Take back your last plant, harvest or field purchase"
              @click="move({ type: 'undo' })"
            >
              ↶ Undo
            </button>
            <button
              v-if="replaying"
              class="secondary"
              @click="emit('skip')"
            >
              Skip ▶▶
            </button>
            <button
              v-if="canFlip"
              class="big"
              @click="move({ type: 'flip_cards' })"
            >
              Flip 2 cards
            </button>
          </div>

          <div
            v-if="pendingCard && me"
            class="pending panel"
          >
            <div class="pending-head">
              <strong>Plant your traded beans</strong>
              <span class="left">{{ me.pending.length }} left</span>
            </div>
            <p class="pending-rule">
              These can't be traded again.
            </p>
            <div class="pending-body">
              <div class="pending-cards">
                <template
                  v-for="group in pendingGroups"
                  :key="group.bean"
                >
                  <div
                    v-if="beanTypes[group.bean]"
                    class="pending-card"
                    draggable="true"
                    @dragstart="pickedPending = group.indexes[0] ?? null"
                  >
                    <span
                      v-if="pendingIndex !== null && group.indexes.includes(pendingIndex)"
                      class="now"
                    >Planting</span>
                    <span
                      v-if="group.indexes.length > 1"
                      class="group-count"
                    >{{ group.indexes.length }}</span>
                    <button
                      class="card-button"
                      :aria-pressed="pendingIndex !== null && group.indexes.includes(pendingIndex)"
                      :aria-label="`Plant the ${beanTypes[group.bean]!.name} bean next`"
                      @click="pickedPending = group.indexes[0] ?? null"
                    >
                      <BeanCard
                        :bean="beanTypes[group.bean]!"
                        size="small"
                        :selected="pendingIndex !== null && group.indexes.includes(pendingIndex)"
                      />
                    </button>
                  </div>
                </template>
              </div>
              <p class="pending-hint">
                {{ pendingHint }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <section class="me">
      <PlayerHand
        :hand="hand"
        :bean-types="beanTypes"
        :can-plant-front="canPlantFromHand"
        :pickable="isDealing"
        :picked="trade.pickedHand.value"
        @pick="trade.toggleHand"
        @point="pointedBean = $event"
      />
    </section>

    <Transition name="peek">
      <div
        v-if="pointedType"
        class="preview"
        aria-hidden="true"
      >
        <BeanCard
          :bean="pointedType"
          size="full"
        />
        <p>{{ pointedCopies }} in your hand</p>
      </div>
    </Transition>

    <Transition name="slide">
      <div
        v-if="showLog"
        class="log-spot"
      >
        <GameLog
          :entries="game.log"
          :you="me?.name ?? 'You'"
          @close="showLog = false"
        />
      </div>
    </Transition>

    <div
      v-if="showPayouts"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Bean payouts"
      @click.self="showPayouts = false"
    >
      <div class="panel payouts">
        <div class="payouts-header">
          <h2>Payouts</h2>
          <button
            class="small secondary"
            @click="showPayouts = false"
          >
            Close
          </button>
        </div>
        <p>Rarer beans pay more. The number under each coin stack is how many beans that payout needs.</p>
        <div class="payout-cards">
          <BeanCard
            v-for="bean in game.bean_types"
            :key="bean.key"
            :bean="bean"
            size="full"
          />
        </div>
      </div>
    </div>

    <Transition name="pop">
      <div
        v-if="game.over && !replaying"
        class="overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
      >
        <div
          v-if="youWon"
          class="confetti"
          aria-hidden="true"
        >
          <img
            v-for="piece in CONFETTI_PIECES"
            :key="piece"
            src="/cards/coin.webp"
            alt=""
            :style="{ left: `${(piece * 53) % 100}%`, animationDelay: `${(piece % 6) * .22}s`, animationDuration: `${2.4 + (piece % 4) * .5}s` }"
          >
        </div>
        <div
          class="panel result"
          :class="{ won: youWon }"
        >
          <p class="kicker">
            The deck ran out for the last time
          </p>
          <h2 id="game-over-title">
            {{ resultTitle }}
          </h2>
          <p class="result-line">
            {{ resultLine }}
          </p>
          <ol>
            <li
              v-for="entry in standings"
              :key="entry.index"
              :class="{ you: entry.index === you, winner: entry.winner }"
            >
              <span class="place">{{ entry.winner ? "👑" : entry.place }}</span>
              <img
                class="face"
                :src="entry.avatar ? `/bots/${entry.avatar}.webp` : '/cards/coin.webp'"
                alt=""
              >
              <span class="who">
                {{ entry.name }}
                <small v-if="entry.winner && wonOnCards">Won the tie with {{ entry.handSize }} cards in hand</small>
                <small v-else-if="entry.lostOnCards">Lost a coin tie: fewer cards in hand</small>
                <small v-else-if="entry.finalHarvest">+{{ coinText(entry.finalHarvest) }} in the final harvest</small>
              </span>
              <span class="score">{{ coinText(entry.coins) }}</span>
            </li>
          </ol>
          <button
            class="big"
            @click="emit('leave')"
          >
            Play again
          </button>
        </div>
      </div>
    </Transition>

    <!-- Outside the zoomed table, so coins and cards land where it measures. -->
    <Teleport to="body">
      <TableEffects
        :event="replaying"
        :player-names="game.players.map((player) => player.name)"
        :bean-types="beanTypes"
      />
    </Teleport>

    <!-- Outside the zoomed table, so the highlight lines up with what it measures. -->
    <Teleport to="body">
      <TutorialGuide
        v-if="showTutorial"
        @close="emit('tutorialDone')"
      />
    </Teleport>

    <!-- The table needs a wide screen; an upright phone is asked to turn. -->
    <Teleport to="body">
      <div
        class="turn-phone"
        role="status"
      >
        <span
          class="turn-icon"
          aria-hidden="true"
        >📱</span>
        <strong>Turn your phone sideways</strong>
        <p>The bazaar needs a wide table.</p>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* The whole screen is the table: bots along the top, the market in the middle,
   your farm and hand along the bottom, with the hand running off the edge. */
/* Pinned to the window: a game table never scrolls. */
.game { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(520px, 1fr) auto; overflow: clip; }

.turn-phone { display: none; }
@media (orientation: portrait) and (max-width: 600px) {
  .turn-phone {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    background: linear-gradient(#a8653a, #8c4f2b);
    color: #fff6dc;
  }
  .turn-phone strong { font-family: "Fraunces", serif; font-size: 24px; }
  .turn-phone p { margin: 0; font-size: 15px; }
  .turn-icon { font-size: 56px; animation: turn 2.4s ease-in-out infinite; }
}
@keyframes turn { 30%, 70% { transform: rotate(-90deg); } }

.topbar { position: relative; z-index: 15; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 10px 20px; }
.tools { justify-self: end; display: flex; gap: 2px; white-space: nowrap; }
/* Menu items, not game actions: plain text so the phase tracker leads the bar. */
.tool { background: none; border: 0; box-shadow: none; padding: 6px 10px; border-radius: 8px; color: #fff6dc; font-size: 14px; text-shadow: 0 1px 0 rgba(0, 0, 0, .45); }
.tool:hover { background: rgba(30, 14, 4, .25); }
.tool[aria-pressed="true"] { background: rgba(30, 14, 4, .35); }
.tool:focus-visible { outline: 3px solid var(--gold); outline-offset: 1px; }

/* Three bands: room for the bots along the top, the market, then your farm. */
.felt { position: relative; display: grid; grid-template-rows: 132px minmax(0, 1fr) auto; justify-items: center; align-items: center; }
/* Lantern light drifts slowly over the table, so quiet moments still feel alive;
   it glows a little warmer each season as the market heats up. */
.felt::before {
  content: "";
  position: fixed;
  inset: -10%;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 45% 35% at 50% 45%, rgba(255, 214, 150, var(--glow)), transparent 70%);
  animation: drift 24s ease-in-out infinite alternate;
}
.felt.season-1 { --glow: .1; }
.felt.season-2 { --glow: .16; }
.felt.season-3 { --glow: .24; }
@keyframes drift {
  from { transform: translate(-6%, -3%) scale(1); }
  to { transform: translate(6%, 4%) scale(1.12); }
}
.felt :deep(.seat) { position: absolute; z-index: 2; }
/* Seats sit on an arc around the market: sides low on the edges, the rest along the top. */
.felt :deep(.spot-left) { left: 2.5%; top: 150px; }
.felt :deep(.spot-right) { right: 2.5%; top: 150px; }
.felt :deep(.spot-top) { left: 50%; top: 0; transform: translateX(-50%); }
.felt :deep(.spot-top-left) { left: 24%; top: 0; transform: translateX(-50%); }
.felt :deep(.spot-top-right) { right: 24%; top: 0; transform: translateX(50%); }
.middle { grid-row: 2; z-index: 1; }

.me { position: relative; z-index: 3; display: grid; gap: 6px; padding: 0 24px; }
.row { display: flex; gap: 28px; align-items: flex-end; justify-content: center; }
.my-spot { grid-row: 3; z-index: 2; padding-bottom: 8px; }
.farm-side { display: grid; gap: 10px; justify-items: center; }
.farm { display: flex; gap: 10px; align-items: stretch; }
.buy-field {
  width: 110px;
  min-height: 190px;
  border-radius: 14px;
  border: 2px dashed #fff6dc;
  background: rgba(255, 246, 220, .12);
  color: #fff6dc;
  box-shadow: none;
  font-size: 14px;
}
.action { min-width: 320px; display: grid; gap: 10px; align-content: center; justify-items: start; }
.plate-row { display: flex; gap: 8px; align-items: center; }
.coin-hop { animation: coin-hop .3s var(--ease-bounce); }
@keyframes coin-hop { 40% { transform: translateY(-6px) scale(1.15) rotate(-8deg); } }
.my-plate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 4px 4px;
  border-radius: 999px;
  background: rgba(255, 246, 220, .95);
  color: var(--ink);
  box-shadow: 0 6px 14px rgba(0, 0, 0, .3);
  transition: box-shadow .25s ease;
}
.my-plate.active { box-shadow: 0 0 0 4px var(--gold), 0 0 26px rgba(246, 201, 56, .7); }
.my-plate img { width: 40px; height: 40px; }
.my-plate strong { font-family: "Fraunces", serif; font-size: 18px; }
.my-plate span { font-weight: 800; color: var(--gold-dark); }
.instruction {
  margin: 0;
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(255, 246, 220, .95);
  color: var(--ink);
  border-radius: 999px;
  padding: 9px 16px;
  font-weight: 800;
  line-height: 1.3;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .3);
}
.instruction.thinking { color: var(--muted); }
.spinner { flex: none; width: 16px; height: 16px; border-radius: 50%; border: 3px solid var(--panel-dark); border-top-color: var(--accent); animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.buttons { display: flex; gap: 8px; }
.pending { width: 430px; display: grid; gap: 8px; padding: 12px 14px; box-shadow: 0 0 0 4px var(--gold), 0 10px 24px rgba(0, 0, 0, .4); }
.pending-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pending-head strong { font-family: "Fraunces", serif; font-size: 17px; }
.left { flex: none; padding: 1px 10px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 12px; font-weight: 800; }
.pending-rule { margin: 0; font-size: 12px; color: var(--muted); }
.pending-body { display: flex; gap: 14px; align-items: center; }
.pending-cards { flex: none; max-width: 290px; display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 0 10px; }
.pending-card { position: relative; cursor: grab; }
.now {
  position: absolute;
  bottom: -10px;
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
.locked-card { position: relative; }
.group-count {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 3;
  min-width: 20px;
  padding: 0 4px;
  text-align: center;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}
.pending-hint { flex: 1; margin: 0; font-size: 13px; font-weight: 800; }
.locked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(255, 246, 220, .95);
  color: var(--ink);
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 6px 14px rgba(0, 0, 0, .3);
}

.preview {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 70;
  display: grid;
  justify-items: center;
  gap: 6px;
  pointer-events: none;
}
.preview p { margin: 0; color: var(--ink); padding: 2px 10px; border-radius: 999px; background: var(--panel); border: 2px solid var(--ink); font-size: 12px; font-weight: 800; }
.peek-enter-active, .peek-leave-active { transition: opacity .15s ease, transform .15s ease; }
.peek-enter-from, .peek-leave-to { opacity: 0; transform: translateY(12px); }
.log-spot { position: fixed; right: 16px; top: 60px; z-index: 20; }
.overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 16px; background: rgba(20, 14, 10, .72); }
.payouts { width: min(980px, 100%); max-height: 90vh; overflow-y: auto; display: grid; gap: 12px; padding: 20px; }
.payouts-header { display: flex; justify-content: space-between; align-items: center; }
.payouts p { margin: 0; }
.payout-cards { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.result { position: relative; width: min(460px, 100%); display: grid; gap: 14px; padding: 26px 24px 24px; text-align: center; }
.result.won { box-shadow: 0 0 0 4px var(--gold), 0 0 60px rgba(246, 201, 56, .55), 0 18px 40px rgba(0, 0, 0, .6); animation: cheer .6s ease-out; }
@keyframes cheer { from { transform: scale(.85); } 60% { transform: scale(1.04); } }
.kicker { margin: 0; font-size: 13px; color: var(--muted); }
.result h2 { font-size: 32px; line-height: 1.1; }
.result.won h2 { color: var(--accent); }
.result-line { margin: -6px 0 4px; font-weight: 700; }
.result ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.result li { display: grid; grid-template-columns: 30px 36px 1fr auto; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 12px; background: var(--panel-dark); text-align: left; border: 2px solid transparent; }
.result li.winner { background: var(--gold); }
/* Your row is outlined, so you find yourself at a glance whatever your place. */
.result li.you { border-color: var(--ink); box-shadow: 0 3px 0 var(--ink); }
.result li.you .who { font-weight: 800; }
.face { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--ink); background: var(--panel); }
.who { display: grid; line-height: 1.2; }
.who small { font-size: 11px; font-weight: 600; color: var(--muted); }
.winner .who small { color: var(--ink); }
.place { font-family: "Fraunces", serif; font-weight: 900; font-size: 20px; text-align: center; }
.score { font-weight: 800; }
.result button { justify-self: center; }
.confetti { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
.confetti img { position: absolute; top: -40px; width: 28px; animation: fall linear infinite; }
@keyframes fall { to { transform: translateY(110vh) rotate(540deg); } }
@media (prefers-reduced-motion: reduce) {
  .confetti { display: none; }
  .result.won { animation: none; }
}

.slide-enter-active, .slide-leave-active { transition: all .2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateX(20px); }
.pop-enter-active, .pop-leave-active { transition: opacity .25s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; }
</style>
