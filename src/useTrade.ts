import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue"
import { quoteTrade, type QuoteAnswer, type TradeCounter } from "./api"
import type { BeanKey, GameState, Move, TradeGive } from "./types"

const QUOTE_DELAY_MS = 250

// "Pinto", "Pinto and Lima", "Pinto, Lima and Fava".
function listNames(names: string[]): string {
  if (names.length < 2) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

// The offer you are building on your trade turn, with each bot's live answer,
// in the style of Colonist: pick what you give and get, bots answer on their seats.
// isTrading covers bidding too: then the active bot is the only partner, and a
// deal is a bid of your hand cards for its face-up cards and beans.
export function useTrade(game: Ref<GameState | null>, isTrading: Ref<boolean>, isBidding: Ref<boolean>, move: (next: Move) => Promise<boolean>) {
  const pickedFaceUp = ref<number[]>([])
  const pickedHand = ref<number[]>([])
  const asks = ref<Record<BeanKey, number>>({})
  const answers = ref<Record<number, QuoteAnswer>>({})
  const counters = ref<Record<number, TradeCounter>>({})
  const quoting = ref(false)
  // True right after an ask was refused for going past what any bot holds.
  const askCapped = ref(false)

  let quoteTimer: ReturnType<typeof setTimeout> | null = null
  let quoteRequest = 0

  const hand = computed<BeanKey[]>(() => (game.value ? game.value.players[game.value.you]?.hand ?? [] : []))
  const askList = computed(() => Object.entries(asks.value).flatMap(([bean, count]) => Array<BeanKey>(count).fill(bean)))
  const gives = computed<TradeGive[]>(() => [
    ...pickedFaceUp.value.flatMap((index) => {
      const bean = game.value?.face_up[index]
      return bean ? [{ bean, source: "face_up" as const, index }] : []
    }),
    ...pickedHand.value.flatMap((index) => {
      const bean = hand.value[index]
      return bean ? [{ bean, source: "hand" as const, index }] : []
    }),
  ])
  const hasOffer = computed(() => gives.value.length + askList.value.length > 0)
  // Giving cards and asking for nothing back is a gift, not a trade. While
  // bidding, picked face-up cards are ones you get, so they make it a trade.
  const isGift = computed(() =>
    gives.value.length > 0 && askList.value.length === 0 && !(isBidding.value && pickedFaceUp.value.length > 0),
  )
  // No bot can hand over more cards than it holds, so asks stop there.
  const maxAsk = computed(() => {
    const current = game.value
    if (!current) return 0
    return Math.max(0, ...current.players.filter((_, index) => index !== current.you).map((player) => player.hand_size))
  })
  const acceptors = computed(() =>
    Object.entries(answers.value).filter(([, answer]) => answer === "accept").map(([player]) => Number(player)),
  )

  // While bidding only the active bot answers, so the status speaks about it by name.
  function bidStatus(): string {
    const name = game.value?.players[game.value.active_index]?.name ?? "The bot"
    if (!hasOffer.value) return `Pick what you give and what you want from ${name}.`
    if (quoting.value) return `Asking ${name}...`
    const answer = Object.values(answers.value)[0]
    if (answer === "accept") return `${name} will trade.`
    if (answer === "missing") return `${name} doesn't have those beans.`
    return `${name} won't take this. Try changing it.`
  }

  const status = computed(() => {
    if (askCapped.value) return `No bot holds more than ${maxAsk.value} cards, so that's the most you can ask for.`
    if (isBidding.value) return bidStatus()
    if (!hasOffer.value) return "Bots answer as soon as you pick."
    if (quoting.value) return "Asking the table..."
    const all = Object.values(answers.value)
    if (all.length && all.every((answer) => answer === "missing")) return "Nobody has those beans right now."
    if (!acceptors.value.length && Object.keys(counters.value).length) return "No takers, but some bots made a counter-offer."
    if (!acceptors.value.length) return "No one wants this deal. Try changing it."
    const names = listNames(acceptors.value.map((player) => game.value?.players[player]?.name ?? ""))
    return acceptors.value.length === 1 ? `${names} will trade.` : `${names} will trade. Pick who on their seat.`
  })

  function toggle(list: Ref<number[]>, index: number): void {
    list.value = list.value.includes(index) ? list.value.filter((picked) => picked !== index) : [...list.value, index]
  }

  function changeAsk(bean: BeanKey, change: number): void {
    askCapped.value = change > 0 && askList.value.length >= maxAsk.value
    if (askCapped.value) return
    const count = Math.max(0, (asks.value[bean] ?? 0) + change)
    const next = { ...asks.value }
    if (count === 0) delete next[bean]
    else next[bean] = count
    asks.value = next
  }

  function clear(): void {
    pickedFaceUp.value = []
    pickedHand.value = []
    asks.value = {}
    answers.value = {}
    counters.value = {}
    askCapped.value = false
  }

  // Makes a bot's counter-offer: keep only the picks it wants, ask for what it offered, then trade.
  async function takeCounter(player: number): Promise<void> {
    const counter = counters.value[player]
    if (!counter) return
    const wanted = [...counter.give]
    const keep = (picked: number[], beanAt: (index: number) => BeanKey | undefined) =>
      picked.filter((index) => {
        const at = wanted.indexOf(beanAt(index) ?? "")
        if (at === -1) return false
        wanted.splice(at, 1)
        return true
      })
    pickedFaceUp.value = keep(pickedFaceUp.value, (index) => game.value?.face_up[index])
    pickedHand.value = keep(pickedHand.value, (index) => hand.value[index])
    asks.value = counter.ask.reduce<Record<BeanKey, number>>((all, bean) => ({ ...all, [bean]: (all[bean] ?? 0) + 1 }), {})
    askCapped.value = false
    await tradeWith(player)
  }

  // Picks waiting for the bid to open: the bot's turned-down offer replays first,
  // and the trade resets when it ends, so they are applied after that.
  let queuedPicks: BeanKey[] | null = null

  // Starts a bid with the bot's own offer picked: its face-up cards to get, and
  // any of its hand beans as asks. You only add what you give.
  function preselect(beans: BeanKey[]): void {
    const faceUp = game.value?.face_up ?? []
    const picked: number[] = []
    const rest: BeanKey[] = []
    beans.forEach((bean) => {
      const index = faceUp.findIndex((card, at) => card === bean && !picked.includes(at))
      if (index === -1) rest.push(bean)
      else picked.push(index)
    })
    pickedFaceUp.value = picked
    asks.value = rest.reduce<Record<BeanKey, number>>((all, bean) => ({ ...all, [bean]: (all[bean] ?? 0) + 1 }), {})
  }

  async function refreshQuote(): Promise<void> {
    const current = game.value
    if (!current || !isTrading.value || !hasOffer.value) {
      answers.value = {}
      counters.value = {}
      quoting.value = false
      return
    }
    const request = ++quoteRequest
    try {
      const quote = await quoteTrade(current.id, {
        face_up_indexes: pickedFaceUp.value,
        hand_indexes: pickedHand.value,
        partner_beans: askList.value,
      })
      // A newer edit already asked again; this answer is stale.
      if (request !== quoteRequest) return
      answers.value = Object.fromEntries(quote.answers.map(({ player, answer }) => [player, answer]))
      counters.value = Object.fromEntries(quote.answers.flatMap(({ player, counter }) => (counter ? [[player, counter]] : [])))
    } catch {
      if (request === quoteRequest) {
        answers.value = {}
        counters.value = {}
      }
    } finally {
      if (request === quoteRequest) quoting.value = false
    }
  }

  watch([pickedFaceUp, pickedHand, asks, isTrading], () => {
    if (quoteTimer) clearTimeout(quoteTimer)
    quoting.value = hasOffer.value && isTrading.value
    quoteTimer = setTimeout(refreshQuote, QUOTE_DELAY_MS)
  })

  // A quote still on its way when the table closes is dropped.
  onBeforeUnmount(() => {
    if (quoteTimer) clearTimeout(quoteTimer)
    quoteRequest += 1
  })

  // Cards move after every trade, so old picks would point at the wrong cards.
  watch(() => [game.value?.face_up.length, hand.value.length, isTrading.value], () => {
    clear()
    if (!isTrading.value || !queuedPicks) return
    preselect(queuedPicks)
    queuedPicks = null
  })

  async function tradeWith(partner: number): Promise<void> {
    const picks = { face_up_indexes: pickedFaceUp.value, hand_indexes: pickedHand.value, partner_beans: askList.value }
    const traded = await move(isBidding.value ? { type: "bid", ...picks } : { type: "trade", partner_index: partner, ...picks })
    if (traded) clear()
  }

  return {
    pickedFaceUp,
    pickedHand,
    asks,
    answers,
    counters,
    gives,
    isGift,
    status,
    acceptors,
    toggleFaceUp: (index: number) => toggle(pickedFaceUp, index),
    toggleHand: (index: number) => toggle(pickedHand, index),
    removeGive: (give: TradeGive) => toggle(give.source === "face_up" ? pickedFaceUp : pickedHand, give.index),
    changeAsk,
    clear,
    takeCounter,
    queuePicks: (beans: BeanKey[] | null) => { queuedPicks = beans },
    tradeWith,
  }
}
