import type { Game, Player } from "../engine"
import type { GameState, Offer, PlayerState } from "../types"
import type { SavedGame } from "./games"

// The game as the human sees it: their own hand in full, the bots' hands as
// counts only. Fields, coins, pending and face-up cards are public at the table.
export function serializeGame(saved: SavedGame, engine: Game): GameState {
  return {
    id: saved.id,
    you: saved.human_index,
    phase: engine.phase,
    active_index: engine.activeIndex,
    hand_plants: engine.handPlants,
    over: engine.isOver(),
    winners: engine.isOver() ? engine.winners().map((winner) => engine.players.indexOf(winner)) : [],
    deck: engine.deck.summary(),
    face_up: [...engine.faceUp.cards],
    players: engine.players.map((player, index) => playerJson(saved, player, index)),
    offer: offerJson(saved, engine),
    // You turned a bot's offer down to make your own; it waits for you.
    bidding: engine.bidding === saved.human_index,
    bot_level: saved.bot_level,
    can_undo: saved.undo_states.length > 0,
    log: engine.log,
    bean_types: engine.beanTypes().map((beanType) => beanType.toJSON()),
  }
}

function playerJson(saved: SavedGame, player: Player, index: number): PlayerState {
  return {
    name: player.name,
    hand: index === saved.human_index ? [...player.hand.cards] : null,
    hand_size: player.hand.size,
    fields: player.fields.map((field) => ({ ...field.toJSON(), coins: field.coins() })),
    coins: player.coins,
    pending: [...player.pending],
  }
}

// A bot's offer waiting for the human, with the cards spelled out. choices are
// beans the bot would take instead of ask, any one of them.
function offerJson(saved: SavedGame, engine: Game): Offer | null {
  const offer = engine.offer
  if (offer === null || offer.partner_index !== saved.human_index) return null

  const give = [
    ...offer.face_up_indexes.map((index) => engine.faceUp.cards[index] as string),
    ...offer.hand_indexes.map((index) => engine.activePlayer.hand.cards[index] as string),
  ]
  return { from: engine.activeIndex, give, ask: [...offer.partner_beans], choices: [...(offer.choices ?? [])] }
}
