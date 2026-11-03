import { readFile } from "node:fs/promises"
import { extname, join, normalize } from "node:path"
import { chromium } from "playwright"

// The built game is served straight from disk through request routing, so no port is opened.
export const GAME_URL = "http://bean.test/"
const GAME_DIR = new URL("../.game-dist/", import.meta.url).pathname
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".png": "image/png" }

// `zoom` renders the 1920x1080 layout into a bigger viewport (2 = 4K frames), since
// Chrome's screencast only sends CSS-pixel frames, not device pixels.
// `rate` below 1 runs the whole page in slow motion (timers, clocks and CSS
// animations), so heavy 4K frames can still be captured at a smooth frame rate.
export async function openGame({ width = 1920, height = 1080, zoom = 1, rate = 1, save = null, tutorialSeen = true, hideHud = false } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: width * zoom, height: height * zoom } })
  await context.route("http://bean.test/**", async (route) => {
    const path = normalize(new URL(route.request().url()).pathname)
    const file = join(GAME_DIR, path.endsWith("/") ? "index.html" : path)
    try {
      await route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" })
    } catch {
      await route.fulfill({ status: 404, body: "" })
    }
  })
  await context.addInitScript(({ save, tutorialSeen }) => {
    if (tutorialSeen) localStorage.setItem("bean-bazaar-tutorial-seen", "yes")
    if (save) {
      localStorage.setItem("bean-bazaar-save", JSON.stringify(save))
      localStorage.setItem("bean-bazaar-game-id", String(save.id))
    }
  }, { save, tutorialSeen })
  if (zoom !== 1) await context.addInitScript((zoom) => document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = String(zoom) }), zoom)
  if (rate !== 1) await context.addInitScript(slowMotion, rate)
  // The status line ("Playing your move...", hints) and its Undo/Skip/Flip buttons
  // blink in and out between moves; on camera they read as flicker, so they go clear.
  if (hideHud) await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style")
    style.textContent = ".instruction, .buttons { opacity: 0 !important; }"
    document.head.append(style)
  }))
  const page = await context.newPage()
  if (rate !== 1) {
    const session = await context.newCDPSession(page)
    await session.send("Animation.enable")
    await session.send("Animation.setPlaybackRate", { playbackRate: rate })
  }
  await page.goto(GAME_URL)
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  return { browser, context, page }
}

// Runs in the page: stretches timers and clocks by 1/rate.
function slowMotion(rate) {
  const realNow = performance.now.bind(performance)
  const realDate = Date.now
  const start = realNow()
  const dateStart = realDate()
  const scaled = () => start + (realNow() - start) * rate
  performance.now = scaled
  Date.now = () => dateStart + (realDate() - dateStart) * rate
  const realTimeout = window.setTimeout
  const realInterval = window.setInterval
  window.setTimeout = (fn, delay = 0, ...args) => realTimeout(fn, delay / rate, ...args)
  window.setInterval = (fn, delay = 0, ...args) => realInterval(fn, delay / rate, ...args)
  const realFrame = window.requestAnimationFrame
  window.requestAnimationFrame = (fn) => realFrame(() => fn(scaled()))
}
