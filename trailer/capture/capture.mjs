import { mkdir } from "node:fs/promises"
import { openGame } from "./browser.mjs"
import { heroMoment } from "./director.mjs"
import { startRecording } from "./record.mjs"

// Every shot is filmed from the seeded hero game in 4K, in slow motion, then
// played back at real speed. Run one with `npm run capture -- <name>`.
// Slow enough that Chrome paints well over 60 frames per second of game time in 4K.
const RATE = 0.12
const OUT = new URL("../public/footage/", import.meta.url).pathname

const field = (page, bean) => page.locator(".field", { hasText: bean })
// Matched on visible text: several buttons carry longer labels, like "Plant Soy".
const button = (scope, text) => scope.locator("button:visible", { hasText: text })

const SHOTS = {
  // Turn one: the first beans go into empty fields.
  "plant-first": { moment: 1, seconds: 4, action: async (page, wait) => {
    await button(page, "Plant here").first().click()
    await wait(1100)
    await button(page, "Plant here").first().click()
  } },
  // A Stink lands on its pile, then two cards flip from the deck.
  "plant-and-flip": { moment: 18, seconds: 5, action: async (page, wait) => {
    await button(field(page, "STINK"), "Plant here").click()
    await wait(1400)
    await button(page, "Flip 2 cards").click()
  } },
  // Pinto wants your Golden bean; you turn him down.
  "offer-golden": { moment: 21, seconds: 4, action: async (page, wait) => {
    await wait(1800)
    await button(page, "No thanks").click()
  } },
  // A bot gives a card away for nothing.
  "gift": { moment: 58, seconds: 4, action: async (page, wait) => {
    await wait(1500)
    await button(page, "Deal!").click()
  } },
  // You end your first turn and the bots take theirs around the table,
  // pitching you offers you wave away.
  "bots-play": { moment: 1, seconds: 16, action: async (page, wait) => {
    await button(page, "Plant here").first().click()
    await wait(700)
    await button(page, "Flip 2 cards").click()
    await wait(1000)
    await button(page, "Done trading").click()
    for (let step = 0; step < 40; step++) {
      await wait(450)
      if (await button(page, "Plant here").count()) await button(page, "Plant here").first().click()
      else if (await button(page, "No thanks").count()) {
        await wait(900)
        await button(page, "No thanks").first().click().catch(() => {})
      }
    }
  } },
  // Mid-game: you turn Pinto down, then the table keeps trading around you.
  "bots-more": { moment: 21, seconds: 24, action: async (page, wait) => {
    for (let step = 0; step < 40; step++) {
      await wait(450)
      if (await button(page, "Plant here").count()) await button(page, "Plant here").first().click()
      else if (await button(page, "No thanks").count()) {
        await wait(700)
        await button(page, "No thanks").first().click().catch(() => {})
      }
    }
  } },
  // A second Golden bean joins the first.
  "golden-plant": { moment: 73, seconds: 4, action: async (page) => {
    await button(field(page, "GOLDEN"), "Plant here").click()
  } },
  // Nine Blue beans cashed in for 3 coins.
  "harvest-blue": { moment: 88, seconds: 4, action: async (page) => {
    await button(field(page, "BLUE"), "Harvest").click()
  } },
  // All four Golden beans, harvested in the last season.
  "golden-harvest": { moment: 103, seconds: 4.5, action: async (page) => {
    await button(field(page, "GOLDEN"), "Harvest").click()
  } },
  // Seven Chilis cashed in: the game's coins float up into your coin plate.
  "harvest-chili": { moment: 103, seconds: 4.5, action: async (page) => {
    await button(field(page, "CHILI"), "Harvest").click()
  } },
  // The full table mid-game, nobody touching anything.
  "table-wide": { moment: 88, seconds: 5, action: async () => {} },
  // The final count: you win the bazaar.
  "game-over": { moment: Infinity, seconds: 6, action: async () => {} },
}

async function film(name) {
  const shot = SHOTS[name]
  const { browser, page } = await openGame({ save: heroMoment(shot.moment), zoom: 2, rate: RATE, hideHud: true })
  const wait = (ms) => page.waitForTimeout(ms / RATE)
  const stop = await startRecording(page, { outFile: `${OUT}${name}.mp4`, width: 3840, height: 2160, rate: RATE })
  await wait(700)
  const acting = shot.action(page, wait)
  await wait(shot.seconds * 1000)
  await acting
  const result = await stop()
  await browser.close()
  console.log(name, result)
}

await mkdir(OUT, { recursive: true })
const names = process.argv.slice(2)
for (const name of names.length ? names : Object.keys(SHOTS)) await film(name)
