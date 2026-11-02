import { describe, expect, it } from "vitest"
import { ApiError, loadGame, quoteTrade, sendMove, startGame } from "./api"

describe("api", () => {
  it("deals a game, plays a move on it, and loads it back", async () => {
    const started = await startGame(2, "easy")
    const planted = await sendMove(started.id, { type: "plant_from_hand", field_index: 0 })

    expect(planted.hand_plants).toBe(1)
    expect(planted.can_undo).toBe(true)
    expect(await loadGame(started.id)).toEqual(planted)
  })

  it("turns a broken rule into an error with the rule's message", async () => {
    const started = await startGame(2, "easy")

    await expect(sendMove(started.id, { type: "flip_cards" })).rejects.toThrow("Plant the front card of your hand first")
    await expect(quoteTrade(started.id, { face_up_indexes: [0], hand_indexes: [], partner_beans: [] })).rejects.toThrow("Wait for your turn")
  })

  it("answers 404 for a game it doesn't have", async () => {
    const missing = loadGame(1)

    await expect(missing).rejects.toBeInstanceOf(ApiError)
    await expect(missing).rejects.toMatchObject({ status: 404, message: "That game no longer exists" })
  })
})
