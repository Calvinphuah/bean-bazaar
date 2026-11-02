import type { BeanKey, EventType, LogEvent, Phase, TableSnapshot } from "../types"
import { tally, uniq } from "./collections"
import { BeanType } from "./beanType"
import { Deck, type DeckData } from "./deck"
import { Hand } from "./hand"
import { IllegalMove } from "./illegalMove"
import { Player, type PlayerData } from "./player"
import type { Random } from "./random"
import { Trade } from "./trade"

// An offer from the active player, waiting for its partner to answer.
export interface OfferData {
  partner_index: number
  face_up_indexes: number[]
  hand_indexes: number[]
  partner_beans: BeanKey[]
  choices: BeanKey[]
}

// An offer turned down this turn, by the beans in it.
export interface DeclinedOffer {
  partner_index: number
  gives: BeanKey[]
  partner_beans: BeanKey[]
  choices: BeanKey[]
}

// Everything needed to rebuild a game; survives a JSON round trip.
export interface GameData {
  players: PlayerData[]
  deck: DeckData
  phase: Phase
  active_index: number
  face_up: BeanKey[]
  hand_plants: number
  log: LogEvent[]
  event_seq: number
  offer: OfferData | null
  offers_this_turn: number
  declined: DeclinedOffer[]
  lacking: BeanKey[][]
  bidding: number | null
}

export interface OfferPicks {
  partnerIndex: number
  faceUpIndexes?: number[]
  handIndexes?: number[]
  partnerBeans?: BeanKey[]
  choices?: BeanKey[]
}

interface GameOptions {
  players: Player[]
  deck: Deck
  phase?: Phase
  activeIndex?: number
  faceUp?: Hand
  handPlants?: number
  log?: LogEvent[]
  eventSeq?: number
  offer?: OfferData | null
  offersThisTurn?: number
  declined?: DeclinedOffer[]
  lacking?: BeanKey[][]
  bidding?: number | null
}

// Runs a whole game. Each turn has four phases:
//   plant          plant the front hand card, optionally the next one
//   trade          flip 2 cards, then trade or gift them and hand cards
//   plant_pending  every player plants the cards they traded for or kept
//   (draw)         the active player draws 3 to the back of their hand
// Players may harvest or buy a third field at any time before the end.
export class Game {
  static readonly MIN_PLAYERS = 3
  static readonly MAX_PLAYERS = 5
  static readonly HAND_SIZE = 5
  static readonly MAX_HAND_PLANTS = 2
  static readonly FLIP_COUNT = 2
  static readonly DRAW_COUNT = 3
  static readonly LOG_SIZE = 60

  readonly players: Player[]
  readonly deck: Deck
  phase: Phase
  activeIndex: number
  faceUp: Hand
  handPlants: number
  log: LogEvent[]
  offer: OfferData | null
  offersThisTurn: number
  // Offers turned down this turn, by the beans in them, so nobody makes the same one twice.
  declined: DeclinedOffer[]
  // Beans each player has said they hold none of, by turning down an offer
  // they couldn't meet. Forgotten once that player draws new cards.
  lacking: BeanKey[][]
  // A player making their own offers to the active player, who waits for them.
  bidding: number | null
  private eventSeq: number

  constructor({
    players,
    deck,
    phase = "plant",
    activeIndex = 0,
    faceUp = new Hand(),
    handPlants = 0,
    log = [],
    eventSeq = 0,
    offer = null,
    offersThisTurn = 0,
    declined = [],
    lacking = [],
    bidding = null,
  }: GameOptions) {
    this.players = players
    this.deck = deck
    this.phase = phase
    this.activeIndex = activeIndex
    this.faceUp = faceUp
    this.handPlants = handPlants
    this.log = log
    this.eventSeq = eventSeq
    this.offer = offer
    this.offersThisTurn = offersThisTurn
    this.declined = declined
    this.lacking = players.map((_player, index) => lacking[index] ?? [])
    this.bidding = bidding
  }

  static start({ names, random = Math.random }: { names: string[]; random?: Random }): Game {
    if (names.length < Game.MIN_PLAYERS || names.length > Game.MAX_PLAYERS) {
      throw new Error(`Bean Bazaar needs ${Game.MIN_PLAYERS}..${Game.MAX_PLAYERS} players`)
    }

    const deck = Deck.shuffled({ playerCount: names.length, random })
    const players = names.map((name) => new Player({ name, hand: new Hand(deck.draw(Game.HAND_SIZE)) }))
    return new Game({ players, deck })
  }

  // Rebuilds a game from toJSON after a JSON round trip.
  static fromJSON(data: GameData, random: Random = Math.random): Game {
    return new Game({
      players: data.players.map((player) => Player.fromJSON(player)),
      deck: Deck.fromJSON(data.deck, random),
      phase: data.phase,
      activeIndex: data.active_index,
      faceUp: Hand.fromJSON(data.face_up),
      handPlants: data.hand_plants,
      log: [...(data.log ?? [])],
      eventSeq: data.event_seq ?? 0,
      offer: data.offer ?? null,
      offersThisTurn: data.offers_this_turn ?? 0,
      declined: [...(data.declined ?? [])],
      lacking: (data.lacking ?? []).map((beans) => [...beans]),
      bidding: data.bidding ?? null,
    })
  }

  toJSON(): GameData {
    return {
      players: this.players.map((player) => player.toJSON()),
      deck: this.deck.toJSON(),
      phase: this.phase,
      active_index: this.activeIndex,
      face_up: this.faceUp.toJSON(),
      hand_plants: this.handPlants,
      log: [...this.log],
      event_seq: this.eventSeq,
      offer: this.offer && { ...this.offer },
      offers_this_turn: this.offersThisTurn,
      declined: [...this.declined],
      lacking: this.lacking.map((beans) => [...beans]),
      bidding: this.bidding,
    }
  }

  // What everyone at the table can see; hands are counts only. Each log entry keeps
  // one, so a client can replay the bots' moves step by step.
  publicTable(): TableSnapshot {
    return {
      phase: this.phase,
      active_index: this.activeIndex,
      deck: this.deck.summary(),
      face_up: [...this.faceUp.cards],
      players: this.players.map((player) => ({
        hand_size: player.hand.size,
        coins: player.coins,
        fields: player.fields.map((field) => field.toJSON()),
        pending: [...player.pending],
      })),
    }
  }

  get activePlayer(): Player {
    return this.players[this.activeIndex] as Player
  }

  // The beans in this game: those for its player count, plus any already in its cards.
  beanTypes(): BeanType[] {
    const held = new Set<BeanKey>([
      ...this.deck.drawPile,
      ...this.deck.discardPile,
      ...this.faceUp.cards,
      ...this.players.flatMap((player) => [
        ...player.hand.cards,
        ...player.pending,
        ...player.fields.flatMap((field) => (field.bean === null ? [] : [field.bean])),
      ]),
    ])
    return BeanType.all.filter((beanType) => beanType.minPlayers <= this.players.length || held.has(beanType.key))
  }

  isOver(): boolean {
    return this.phase === "over"
  }

  winners(): Player[] {
    if (!this.isOver()) throw new IllegalMove("The game isn't over yet")

    // A tie on coins goes to whoever has more cards left in hand.
    const topCoins = Math.max(...this.players.map((player) => player.coins))
    const rich = this.players.filter((player) => player.coins === topCoins)
    const topHand = Math.max(...rich.map((player) => player.hand.size))
    return rich.filter((player) => player.hand.size === topHand)
  }

  plantFromHand(fieldIndex: number): void {
    if (this.handPlants >= Game.MAX_HAND_PLANTS) throw new IllegalMove(`You can plant at most ${Game.MAX_HAND_PLANTS} cards from your hand`)

    this.requirePhase("plant")
    const card = this.activePlayer.hand.front()
    if (card === undefined) throw new IllegalMove("Your hand is empty")

    this.activePlayer.plant(card, fieldIndex)
    this.activePlayer.hand.takeFront()
    this.handPlants += 1
    this.note("plant", this.activeIndex, `${this.activePlayer.name} planted ${beanNames([card])}`)
    if (!this.canPlantFromHand()) this.flipCards()
  }

  flipCards(): void {
    this.requirePhase("plant")
    if (this.handPlants === 0 && !this.activePlayer.hand.isEmpty()) throw new IllegalMove("Plant the front card of your hand first")

    this.faceUp = new Hand(this.deck.draw(Game.FLIP_COUNT))
    this.phase = "trade"
    if (!this.faceUp.isEmpty()) this.note("flip", this.activeIndex, `${this.activePlayer.name} flipped ${beanNames(this.faceUp.cards)}`)
    if (this.deck.isExhausted()) this.finish()
  }

  trade({
    partnerIndex,
    faceUpIndexes = [],
    handIndexes = [],
    partnerHandIndexes = [],
  }: { partnerIndex: number; faceUpIndexes?: number[]; handIndexes?: number[]; partnerHandIndexes?: number[] }): void {
    this.requirePhase("trade")
    this.requireNoOffer()

    this.executeTrade(this.playerAt(partnerIndex), faceUpIndexes, handIndexes, partnerHandIndexes)
  }

  // The active player asks another player for bean types, since hands are hidden:
  // all of partnerBeans, plus any one of choices, which the partner picks.
  // The offer waits until that player accepts or declines it.
  propose({ partnerIndex, faceUpIndexes = [], handIndexes = [], partnerBeans = [], choices = [] }: OfferPicks): void {
    this.requirePhase("trade")
    this.requireNoOffer()
    const partner = this.playerAt(partnerIndex)
    if (partner === this.activePlayer) throw new IllegalMove("You can't trade with yourself")
    if ([faceUpIndexes, handIndexes, partnerBeans, choices].every((picks) => picks.length === 0)) {
      throw new IllegalMove("An offer needs at least one card")
    }

    this.faceUp.check(faceUpIndexes)
    this.activePlayer.hand.check(handIndexes)
    this.offer = {
      partner_index: partnerIndex,
      face_up_indexes: [...faceUpIndexes],
      hand_indexes: [...handIndexes],
      partner_beans: [...partnerBeans],
      choices: [...choices],
    }
    this.offersThisTurn += 1
    this.note("offer", this.activeIndex, this.offerMessage(this.offer, partner))
  }

  // `bean` is which of the offer's choices the partner gives.
  acceptOffer({ bean }: { bean?: BeanKey | null } = {}): void {
    const waiting = this.requireOffer()
    const partner = this.playerAt(waiting.partner_index)
    const asked = [...waiting.partner_beans, ...this.chosenBean(waiting, bean)]
    const partnerHandIndexes = partner.hand.indexesOf(asked)
    // Only the player answering sees this, so it speaks to them.
    if (partnerHandIndexes === null) throw new IllegalMove(`You have no ${beanNames(asked)} to give`)

    this.offer = null
    this.executeTrade(partner, waiting.face_up_indexes, waiting.hand_indexes, partnerHandIndexes)
  }

  declineOffer(): void {
    const waiting = this.requireOffer()
    const partner = this.playerAt(waiting.partner_index)
    this.offer = null
    this.declined = [
      ...this.declined,
      offerRecord(waiting.partner_index, this.offerCards(waiting), waiting.partner_beans, offerChoices(waiting)),
    ]
    this.rememberLacking(waiting.partner_index, [...waiting.partner_beans, ...offerChoices(waiting)])
    this.note("decline", waiting.partner_index, `${partner.name} turned down ${this.activePlayer.name}'s offer`)
  }

  // Whether this offer, card for card, was already turned down this turn.
  isDeclined({ partnerIndex, faceUpIndexes = [], handIndexes = [], partnerBeans = [], choices = [] }: OfferPicks): boolean {
    const cards = [
      ...faceUpIndexes.map((index) => this.faceUp.cards[index] as BeanKey),
      ...handIndexes.map((index) => this.activePlayer.hand.cards[index] as BeanKey),
    ]
    const record = offerRecord(partnerIndex, cards, partnerBeans, choices)
    return this.declined.some((declined) => sameRecord(declined, record))
  }

  // Instead of answering the waiting offer, its partner makes their own: the
  // offer counts as turned down, and the active player waits while they bid.
  openBids(): void {
    const waiting = this.requireOffer()
    this.declineOffer()
    this.bidding = waiting.partner_index
  }

  // The bidder gives hand cards for the active player's face-up cards and beans
  // asked for from its hand, as any player may at a real table. Bidding stays
  // open for more deals until closeBids.
  bid({
    faceUpIndexes = [],
    activeBeans = [],
    bidderHandIndexes = [],
  }: { faceUpIndexes?: number[]; activeBeans?: BeanKey[]; bidderHandIndexes?: number[] }): void {
    const bidder = this.requireBidding()
    const activeHandIndexes = this.activePlayer.hand.indexesOf(activeBeans)
    if (activeHandIndexes === null) throw new IllegalMove(`${this.activePlayer.name} has no ${beanNames(activeBeans)} to give`)

    this.executeTrade(bidder, faceUpIndexes, activeHandIndexes, bidderHandIndexes)
  }

  closeBids(): void {
    this.requireBidding()
    this.bidding = null
  }

  // Face-up cards nobody traded for stay with the active player.
  endTrading(): void {
    this.requirePhase("trade")
    this.requireNoOffer()
    if (this.bidding !== null) throw new IllegalMove("Wait for the bids to finish")

    const kept = this.faceUp.takeAll()
    this.activePlayer.receive(kept)
    if (kept.length > 0) this.note("keep", this.activeIndex, `${this.activePlayer.name} kept ${beanNames(kept)}`)
    this.phase = "plant_pending"
    if (this.nothingPending()) this.finishTurn()
  }

  plantPending({ playerIndex, pendingIndex, fieldIndex }: { playerIndex: number; pendingIndex: number; fieldIndex: number }): void {
    this.requirePhase("plant_pending")

    const player = this.playerAt(playerIndex)
    const card = player.pending[pendingIndex]
    player.plantPending(pendingIndex, fieldIndex)
    this.note("plant", playerIndex, `${player.name} planted ${beanNames([card as BeanKey])}`)
    if (this.nothingPending()) this.finishTurn()
  }

  harvest({ playerIndex, fieldIndex }: { playerIndex: number; fieldIndex: number }): void {
    if (this.isOver()) throw new IllegalMove("The game is over")

    const player = this.playerAt(playerIndex)
    const coinsBefore = player.coins
    const field = player.fields[fieldIndex]
    const bean = field?.bean
    const count = field?.count
    this.deck.discard(player.harvest(fieldIndex))
    const earned = player.coins - coinsBefore
    this.note("harvest", playerIndex, `${player.name} harvested ${count} ${BeanType.find(bean as BeanKey).name} for ${coinText(earned)}`)
  }

  buyThirdField({ playerIndex }: { playerIndex: number }): void {
    if (this.isOver()) throw new IllegalMove("The game is over")

    const player = this.playerAt(playerIndex)
    this.deck.discard(player.buyThirdField())
    this.note("buy_field", playerIndex, `${player.name} bought a third field`)
  }

  // Once a second card is planted, or the hand runs out, the only move left is the flip.
  private canPlantFromHand(): boolean {
    return this.handPlants < Game.MAX_HAND_PLANTS && !this.activePlayer.hand.isEmpty()
  }

  private requirePhase(expected: Phase): void {
    if (this.phase !== expected) throw new IllegalMove(`You can't do that during the ${this.phase} phase`)
  }

  private requireNoOffer(): void {
    if (this.offer) throw new IllegalMove("Answer the waiting offer first")
  }

  private requireOffer(): OfferData {
    if (!this.offer) throw new IllegalMove("There is no offer to answer")
    return this.offer
  }

  private requireBidding(): Player {
    this.requirePhase("trade")
    if (this.bidding === null) throw new IllegalMove("Nobody is making offers right now")

    return this.players[this.bidding] as Player
  }

  private playerAt(index: number): Player {
    const player = this.players[index]
    if (!player) throw new IllegalMove(`There is no player ${index}`)
    return player
  }

  private nothingPending(): boolean {
    return this.players.every((player) => player.pending.length === 0)
  }

  private executeTrade(partner: Player, faceUpIndexes: number[], handIndexes: number[], partnerHandIndexes: number[]): void {
    const [offered, requested] = new Trade({
      active: this.activePlayer,
      partner,
      faceUp: this.faceUp,
      faceUpIndexes,
      handIndexes,
      partnerHandIndexes,
    }).execute()
    this.note("trade", this.activeIndex, this.tradeMessage(partner, offered, requested))
  }

  // The partner couldn't have met this ask, so others stop asking for those beans.
  private rememberLacking(playerIndex: number, asked: BeanKey[]): void {
    const held = tally(this.playerAt(playerIndex).hand.cards)
    const missing = [...tally(asked)].filter(([bean, wanted]) => (held.get(bean) ?? 0) < wanted).map(([bean]) => bean)
    this.lacking[playerIndex] = uniq([...(this.lacking[playerIndex] ?? []), ...missing])
  }

  private finishTurn(): void {
    this.activePlayer.hand.add(this.deck.draw(Game.DRAW_COUNT))
    this.lacking[this.activeIndex] = []
    if (this.deck.isExhausted()) return this.finish()

    this.activeIndex = (this.activeIndex + 1) % this.players.length
    this.handPlants = 0
    this.offersThisTurn = 0
    this.declined = []
    this.phase = "plant"
    this.note("turn", this.activeIndex, `${this.activePlayer.name}'s turn`)
  }

  // The deck ran out for the last time: clear the table and harvest everything.
  private finish(): void {
    this.offer = null
    this.deck.discard(this.faceUp.takeAll())
    for (const player of this.players) this.deck.discard(player.pending.splice(0))
    this.players.forEach((_player, index) => this.finalHarvest(index))
    this.phase = "over"
    this.note("game_over", null, "The deck ran out for the third time. Game over!")
  }

  // One log entry per player, so the replay shows each table being cashed in.
  private finalHarvest(playerIndex: number): void {
    const player = this.playerAt(playerIndex)
    if (player.fields.every((field) => field.isEmpty())) return

    const coinsBefore = player.coins
    this.deck.discard(player.harvestAll())
    this.note("final_harvest", playerIndex, `${player.name} earned ${coinText(player.coins - coinsBefore)} in the final harvest`)
  }

  private note(type: EventType, playerIndex: number | null, text: string): void {
    this.eventSeq += 1
    const entry: LogEvent = { seq: this.eventSeq, type, player: playerIndex, text, table: this.publicTable() }
    this.log = [...this.log, entry].slice(-Game.LOG_SIZE)
  }

  private tradeMessage(partner: Player, offered: BeanKey[], requested: BeanKey[]): string {
    const active = this.activePlayer.name
    if (offered.length === 0) return `${partner.name} gave ${beanNames(requested)} to ${active}`
    if (requested.length === 0) return `${active} gave ${beanNames(offered)} to ${partner.name}`

    return `${active} traded ${beanNames(offered)} to ${partner.name} for ${beanNames(requested)}`
  }

  private offerCards(waiting: OfferData): BeanKey[] {
    return [
      ...waiting.face_up_indexes.map((index) => this.faceUp.cards[index] as BeanKey),
      ...waiting.hand_indexes.map((index) => this.activePlayer.hand.cards[index] as BeanKey),
    ]
  }

  // `bean` must be one of the offer's choices; nothing when the offer has none.
  private chosenBean(waiting: OfferData, bean: BeanKey | null | undefined): BeanKey[] {
    const choices = offerChoices(waiting)
    if (choices.length === 0) return []
    if (!bean || !choices.includes(bean)) throw new IllegalMove(`Pick one of ${beanNames(choices, " or ")} to give`)

    return [bean]
  }

  private offerMessage(offer: OfferData, partner: Player): string {
    const active = this.activePlayer.name
    const gives = this.offerCards(offer)
    // Choices read "Soy or Blue"; a bot offers them instead of fixed asks.
    const asks = offer.partner_beans.length > 0 ? beanNames(offer.partner_beans) : beanNames(offerChoices(offer), " or ")
    if (gives.length === 0) return `${active} asks ${partner.name} for ${asks}`
    if (asks === "") return `${active} offers ${partner.name} ${beanNames(gives)} as a gift`

    return `${active} offers ${partner.name} ${beanNames(gives)} for ${asks}`
  }
}

function beanNames(cards: BeanKey[], joiner = " and "): string {
  return cards.map((card) => BeanType.find(card).name).join(joiner)
}

function coinText(coins: number): string {
  return `${coins} ${coins === 1 ? "coin" : "coins"}`
}

// Offers saved before choices existed have none.
function offerChoices(offer: OfferData): BeanKey[] {
  return offer.choices ?? []
}

function offerRecord(partnerIndex: number, cards: BeanKey[], partnerBeans: BeanKey[], choices: BeanKey[]): DeclinedOffer {
  return { partner_index: partnerIndex, gives: [...cards].sort(), partner_beans: [...partnerBeans].sort(), choices: [...choices].sort() }
}

function sameRecord(left: DeclinedOffer, right: DeclinedOffer): boolean {
  const sameBeans = (one: BeanKey[], other: BeanKey[] = []) => one.length === other.length && one.every((bean, index) => bean === other[index])
  return (
    left.partner_index === right.partner_index &&
    sameBeans(left.gives, right.gives) &&
    sameBeans(left.partner_beans, right.partner_beans) &&
    sameBeans(left.choices ?? [], right.choices)
  )
}
