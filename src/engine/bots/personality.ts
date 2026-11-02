// How a named bot leans when it trades, on top of its level. Each knob nudges
// one judgement, so the bots feel different without any of them playing badly.
//   giftKindness  how much less a gift must be worth before it takes it
//   leadWariness  how strongly it resists helping whoever is ahead
//   dealMargin    how far ahead a swap must come out before it agrees
//   uprootScale   how much it minds digging up a field for a new bean
//   hoards        whether it guards the bean of its biggest field
export interface Personality {
  giftKindness: number
  leadWariness: number
  dealMargin: number
  uprootScale: number
  hoards: boolean
}

export const PLAIN: Personality = { giftKindness: 0, leadWariness: 1.0, dealMargin: 1, uprootScale: 1.0, hoards: false }

export const PERSONALITIES: Readonly<Record<string, Personality>> = {
  // Generous: happy to take and give gifts, shrugs at who is winning.
  Pinto: { giftKindness: 1, leadWariness: 0.5, dealMargin: 1, uprootScale: 1.0, hoards: false },
  // Shrewd: watches the leader closely and won't feed them.
  Lima: { giftKindness: 0, leadWariness: 2.0, dealMargin: 1, uprootScale: 1.0, hoards: false },
  // Collector: guards the bean of its biggest field above all else.
  Fava: { giftKindness: 0, leadWariness: 1.0, dealMargin: 1, uprootScale: 1.0, hoards: true },
  // Gambler: digs up fields lightly to chase a new bean.
  Mung: { giftKindness: 0, leadWariness: 1.0, dealMargin: 1, uprootScale: 0.5, hoards: false },
}

// A bot whose name has no personality plays it straight.
export function personalityFor(name: string): Personality {
  return PERSONALITIES[name] ?? PLAIN
}
