import type { BeanKey } from "../../types"
import { BeanType } from "../beanType"
import { count, maxBy, sortBy, tally, uniq, withoutOne } from "../collections"
import type { Field } from "../field"
import { Game, type OfferPicks } from "../game"
import type { CounterOffer, Deal } from "./bot"
import { personalityFor, type Personality } from "./personality"
import { SimpleBot } from "./simpleBot"

// Plays to win: plans around its hand order and values cards by coins they bring closer.
export class SmartBot extends SimpleBot {
  // How many cards past the front of the hand it plans around.
  static readonly LOOKAHEAD = 3
  // Deal scoring, in rough "points" where a coin is worth COIN_VALUE.
  static readonly COIN_VALUE = 3
  // A bean it plants towards a coin; a bean starting a fresh field is worth less.
  static readonly GROWING_BEAN_VALUE = 2
  static readonly NEW_FIELD_BEAN_VALUE = 1
  // Every bean the asker wants helps a rival, so a fair swap must pay for it,
  // and more so for every coin the asker is ahead, up to MAX_LEAD_COST.
  static readonly HELP_COST = 1
  static readonly MAX_LEAD_COST = 3
  // A gift fills a field, so it must be worth more than one lonely bean.
  static readonly MIN_GIFT_VALUE = 2
  // With three offers a turn the human's seat wins as often as a bot's; with two it falls behind.
  static readonly MAX_OFFERS_TO_HUMAN = 3
  // A swap lists up to this many beans it would take, so the human can pick one they hold.
  static readonly MAX_CHOICES = 3
  // What a hoarding bot thinks its favourite bean is worth keeping.
  static readonly HOARD_VALUE = 8

  protected humanIndex: number | null = null

  playPlantPhase(): void {
    this.buyFieldIfRich()
    if (!this.player.hand.isEmpty()) this.plantFront()
    if (this.wantsSecondPlant()) this.plantFront()
    if (this.game.isOver()) return

    this.cashInFullFields()
    if (this.game.phase === "plant") this.game.flipCards()
  }

  // The human sees the cards before the bots share them out; the runner calls back once they answer.
  playTradePhase({ partnerIndexes, humanIndex = null }: { partnerIndexes: number[]; humanIndex?: number | null }): void {
    this.humanIndex = humanIndex
    if (this.proposeToHuman(humanIndex)) return

    this.offerUnwantedCards(partnerIndexes)
    this.offerJunkHand(partnerIndexes)
    if (this.game.offer === null) this.game.endTrading()
  }

  // Plants cards that already fit first, so any harvest frees the right field.
  plantPending(): void {
    while (this.player.pending.length > 0 && this.game.phase === "plant_pending") {
      const pending = this.player.pending
      const growing = pending.findIndex((card) => this.grows(card))
      const fitting = pending.findIndex((card) => this.fits(card))
      const index = growing !== -1 ? growing : fitting !== -1 ? fitting : 0
      this.game.plantPending({ playerIndex: this.playerIndex, pendingIndex: index, fieldIndex: this.fieldFor(pending[index] as BeanKey) })
    }
  }

  // Takes a deal only when it comes out ahead, judging the deal as a whole:
  // where every offered bean would be planted, what it gives up, and how much
  // the asker gains. Junk gifts and one-sided swaps get turned down.
  accepts({ offered, requested }: Deal): boolean {
    const value = this.dealValue(offered, requested)
    return requested.length === 0 ? value >= this.minGiftValue() : value >= this.personality.dealMargin
  }

  // A smaller deal it would take instead: it drops whichever card helps it most,
  // one at a time, until the deal comes out ahead. When the asker wanted beans it
  // keeps at least one in, so a counter is never just "give me your card".
  // Null when no smaller deal works.
  counterOffer({ offered, requested }: Deal): CounterOffer | null {
    const mustGive = requested.length > 0
    for (;;) {
      const options: [BeanKey[], BeanKey[]][] = [
        ...uniq(offered).map((card): [BeanKey[], BeanKey[]] => [withoutOne(offered, card), requested]),
        ...uniq(requested).map((card): [BeanKey[], BeanKey[]] => [offered, withoutOne(requested, card)]),
      ].filter(([optionOffered, optionRequested]) => {
        if (mustGive && optionRequested.length === 0) return false
        return optionOffered.length > 0 || optionRequested.length > 0
      })
      if (options.length === 0) return null

      ;[offered, requested] = maxBy(options, ([optionOffered, optionRequested]) => this.dealValue(optionOffered, optionRequested)) as [BeanKey[], BeanKey[]]
      if (this.accepts({ offered, requested })) return { offered, requested }
    }
  }

  // Gifts go to the poorest player, the human included; junk no bot wants clogged the human's fields.
  protected offer(partnerIndexes: number[], picks: { faceUpIndexes?: number[]; handIndexes?: number[] }): boolean {
    if (this.game.offer) return false
    if (this.isHumanPoorest(partnerIndexes) && this.giftToHuman(picks.faceUpIndexes ?? [], picks.handIndexes ?? [])) return true

    return super.offer(partnerIndexes, picks)
  }

  protected isHumanPoorest(partnerIndexes: number[]): boolean {
    if (this.humanIndex === null) return false

    const humanCoins = this.game.players[this.humanIndex]!.coins
    return partnerIndexes.every((index) => humanCoins <= this.game.players[index]!.coins)
  }

  protected giftToHuman(faceUpIndexes: number[], handIndexes: number[]): boolean {
    if (this.humanIndex === null || this.game.offersThisTurn >= SmartBot.MAX_OFFERS_TO_HUMAN) return false

    const gift: OfferPicks = { partnerIndex: this.humanIndex, faceUpIndexes, handIndexes }
    if (this.game.isDeclined(gift)) return false

    this.game.propose(gift)
    return true
  }

  // Hands off hand cards it has no field for, so its next plants stay smooth.
  protected offerJunkHand(partnerIndexes: number[]): void {
    for (;;) {
      const handIndex = this.junkHandIndex()
      if (handIndex === null || !this.offer(partnerIndexes, { handIndexes: [handIndex] })) break
    }
  }

  // A third field pays off early, while there are reshuffles left to fill it.
  protected buyFieldIfRich(): void {
    if (this.game.deck.runOuts >= 2) return

    super.buyFieldIfRich()
  }

  protected wantsSecondPlant(): boolean {
    const card = this.player.hand.front()
    if (card === undefined || this.game.handPlants >= Game.MAX_HAND_PLANTS) return false

    return this.grows(card) || (this.fits(card) && !this.isNeededSoonForEmptyField(card))
  }

  // Keep an empty field free if a different upcoming card needs it more.
  protected isNeededSoonForEmptyField(card: BeanKey): boolean {
    const upcoming = this.player.hand.cards.slice(1, 1 + SmartBot.LOOKAHEAD)
    const emptyFields = this.player.fields.filter((field) => field.isEmpty()).length
    const others = uniq(upcoming).filter((bean) => bean !== card && !this.grows(bean))
    return emptyFields <= others.length
  }

  // A field past its top payout gains nothing more, so sell it now. Such a field
  // always holds several beans, so the lone-bean rule never blocks it.
  protected cashInFullFields(): void {
    this.player.fields.forEach((field, index) => {
      if (field.isEmpty() || BeanType.find(field.bean as BeanKey).nextStep(field.count) !== null) return

      this.game.harvest({ playerIndex: this.playerIndex, fieldIndex: index })
    })
  }

  // Picks the field that loses least: high coins now, and no copies coming soon.
  protected makeRoom(): number {
    const fieldIndex = maxBy(this.harvestableIndexes(), (index) => this.harvestScore(this.player.fields[index]!)) as number
    this.game.harvest({ playerIndex: this.playerIndex, fieldIndex })
    return fieldIndex
  }

  protected harvestScore(field: Field): number {
    const coming = count(this.player.hand.cards.slice(0, SmartBot.LOOKAHEAD + 1), field.bean as BeanKey)
    return field.coins() * 10 - coming * 6 - field.count
  }

  protected dealValue(offered: BeanKey[], requested: BeanKey[]): number {
    const keeping = requested.reduce((sum, card) => sum + this.keepingValue(card), 0)
    return this.incomingValue(offered) - keeping - requested.length * this.helpCost()
  }

  protected get personality(): Personality {
    return personalityFor(this.player.name)
  }

  protected minGiftValue(): number {
    return SmartBot.MIN_GIFT_VALUE - this.personality.giftKindness
  }

  // Helping a leader costs more.
  protected helpCost(): number {
    const lead = this.game.players[this.askerIndex()]!.coins - this.player.coins
    const clamped = Math.min(Math.max(lead, 0), SmartBot.MAX_LEAD_COST)
    return SmartBot.HELP_COST + Math.round(clamped * this.personality.leadWariness)
  }

  // The active player asks, unless this bot is active and someone is bidding to it.
  protected askerIndex(): number {
    return this.game.bidding !== null && this.playerIndex === this.game.activeIndex ? this.game.bidding : this.game.activeIndex
  }

  // A flipped card that fits a free field is worth keeping: it must be planted
  // anyway, and giving it away only helps a rival.
  protected unwantedFaceUpIndex(): number | null {
    const keep = this.keepableNewBean()
    const index = this.game.faceUp.cards.findIndex((card) => !this.grows(card) && card !== keep)
    return index === -1 ? null : index
  }

  // The one new bean it would start a field with, if a field is free for it.
  protected keepableNewBean(): BeanKey | null {
    const freeFields = this.player.fields.filter((field) => field.isEmpty()).length - this.fieldsWantedByHand([])
    if (freeFields <= 0) return null

    return this.game.faceUp.cards.find((card) => !this.grows(card)) ?? null
  }

  // Plants the offered beans in its head: beans that grow a field come first,
  // each new bean type takes an empty field, then a field it must dig up.
  // Fields getting beans from this deal can't be dug up, so a deal with more
  // new types than it can place is refused outright.
  protected incomingValue(cards: BeanKey[]): number {
    const beans = tally(cards)
    let freeFields = this.player.fields.filter((field) => field.isEmpty()).length - this.fieldsWantedByHand(cards)
    const spareFields = this.uprootableFields(beans)
    let total = 0
    for (const [bean, beanCount] of sortBy([...beans], ([bean, beanCount]) => [this.grows(bean) ? 0 : 1, -beanCount])) {
      if (this.grows(bean)) {
        total += this.growingValue(bean, beanCount)
        continue
      }
      freeFields -= 1
      if (freeFields >= 0) {
        total += this.newFieldValue(bean, beanCount)
        continue
      }

      const field = spareFields.shift()
      if (field === undefined) return -Infinity

      total += this.newFieldValue(bean, beanCount) - this.uprootingCost(field)
    }
    return total
  }

  // The fields it could dig up for a new bean, in the order makeRoom would pick
  // them, so the plan and the harvest agree.
  protected uprootableFields(beans: Map<BeanKey, number>): Field[] {
    const fields = this.harvestableIndexes()
      .map((index) => this.player.fields[index]!)
      .filter((field) => !field.isEmpty() && !beans.has(field.bean as BeanKey))
    return sortBy(fields, (field) => -this.harvestScore(field))
  }

  protected growingValue(bean: BeanKey, beanCount: number): number {
    const field = this.player.fields.find((candidate) => candidate.bean === bean) as Field
    const type = BeanType.find(bean)
    const coinsGained = type.coinsFor(field.count + beanCount) - type.coinsFor(field.count)
    return beanCount * SmartBot.GROWING_BEAN_VALUE + coinsGained * SmartBot.COIN_VALUE
  }

  // A fresh field is worth more when its own hand is about to add to it.
  protected newFieldValue(bean: BeanKey, beanCount: number): number {
    const coming = count(this.player.hand.cards.slice(0, SmartBot.LOOKAHEAD + 1), bean)
    return (beanCount + coming) * SmartBot.NEW_FIELD_BEAN_VALUE + BeanType.find(bean).coinsFor(beanCount + coming) * SmartBot.COIN_VALUE
  }

  // Digging up a field throws away the beans that haven't reached a coin yet.
  protected uprootingCost(field: Field): number {
    return (SmartBot.COIN_VALUE + Math.max(field.count - field.coins() * SmartBot.COIN_VALUE, 0)) * this.personality.uprootScale
  }

  // An empty field stays free for the front card, which must be planted next turn.
  // Reserving more than that turns down too many useful trades.
  protected fieldsWantedByHand(offered: BeanKey[]): number {
    const front = this.player.hand.front()
    return front === undefined || this.grows(front) || offered.includes(front) ? 0 : 1
  }

  // What a hand card is worth keeping: a bean it grows is valuable, a card with
  // nowhere to go is a relief to hand over.
  protected keepingValue(card: BeanKey): number {
    if (this.personality.hoards && card === this.biggestBean()) return SmartBot.HOARD_VALUE
    if (this.grows(card)) return SmartBot.GROWING_BEAN_VALUE + 1
    if (this.player.fields.some((field) => field.isEmpty())) return 0

    return -1
  }

  protected biggestBean(): BeanKey | null {
    return maxBy(this.player.fields, (field) => field.count)?.bean ?? null
  }

  // Gives the human a card it can't use for any one of the beans it grows, or,
  // once that was turned down, offers it as a gift. False when it has nothing
  // new to offer.
  protected proposeToHuman(humanIndex: number | null): boolean {
    if (humanIndex === null || this.game.offersThisTurn >= SmartBot.MAX_OFFERS_TO_HUMAN) return false

    const offer = this.offersForHuman(humanIndex).find((candidate) => !this.game.isDeclined(candidate))
    if (offer === undefined) return false

    this.game.propose(offer)
    return true
  }

  // The swap, then the same cards as a gift.
  protected offersForHuman(humanIndex: number): OfferPicks[] {
    const faceUpIndex = this.unwantedFaceUpIndex()
    const handIndex = faceUpIndex === null ? this.junkHandIndex() : null
    if (faceUpIndex === null && handIndex === null) return []

    const faceUpIndexes = faceUpIndex === null ? [] : [faceUpIndex]
    const handIndexes = handIndex === null ? [] : [handIndex]
    const cards = [
      ...faceUpIndexes.map((index) => this.game.faceUp.cards[index] as BeanKey),
      ...handIndexes.map((index) => this.player.hand.cards[index] as BeanKey),
    ]
    const turnedDown = this.turnedDownChoices(humanIndex, cards)
    const choices = this.wantedBeans(humanIndex).filter((bean) => !turnedDown.includes(bean)).slice(0, SmartBot.MAX_CHOICES)
    const choiceLists = choices.length > 0 ? [choices, []] : [[]]
    return choiceLists.map((offeredChoices) => ({ partnerIndex: humanIndex, faceUpIndexes, handIndexes, choices: offeredChoices }))
  }

  // Beans the human already refused to give for these same cards this turn.
  protected turnedDownChoices(humanIndex: number, cards: BeanKey[]): BeanKey[] {
    const gives = [...cards].sort().join(",")
    return this.game.declined
      .filter((record) => record.partner_index === humanIndex && [...record.gives].join(",") === gives)
      .flatMap((record) => record.choices ?? [])
  }

  // The last hand card that fits none of its fields: the one it would plant latest.
  protected junkHandIndex(): number | null {
    const cards = this.player.hand.cards
    for (let index = cards.length - 1; index >= 0; index--) {
      if (!this.fits(cards[index] as BeanKey)) return index
    }
    return null
  }

  protected wantedBean(partnerIndex: number): BeanKey | null {
    return this.wantedBeans(partnerIndex)[0] ?? null
  }

  // The beans it grows, the one closest to its next coin first, skipping beans
  // the partner has already said they hold none of.
  protected wantedBeans(partnerIndex: number): BeanKey[] {
    const lacking = this.game.lacking[partnerIndex] ?? []
    const fields = this.player.fields.filter((field) => !field.isEmpty() && !lacking.includes(field.bean as BeanKey))
    const ranked = sortBy(
      fields.map((field, index) => ({ field, index })),
      ({ field, index }) => [(BeanType.find(field.bean as BeanKey).nextStep(field.count) ?? 0) - field.count, index],
    )
    return uniq(ranked.map(({ field }) => field.bean as BeanKey))
  }
}
