import { linkSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"

// Records the page through Chrome's screencast: every painted frame arrives as a
// high-quality JPEG with its timestamp and goes straight to disk (4K frames would
// fill memory). `rate` is the page's slow-motion rate; frame times are scaled back
// to real speed.
export async function startRecording(page, { outFile, width, height, rate = 1 }) {
  const dir = `${outFile}.frames`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(`${dir}/raw`, { recursive: true })
  const times = []
  let recording = true
  const session = await page.context().newCDPSession(page)
  session.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    // Frames can still arrive after stopping; they must not land in a deleted folder.
    if (!recording) return
    writeFileSync(`${dir}/raw/${times.length}.jpg`, Buffer.from(data, "base64"))
    times.push(metadata.timestamp * rate)
    session.send("Page.screencastFrameAck", { sessionId }).catch(() => {})
  })
  await session.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: width, maxHeight: height, everyNthFrame: 1 })

  return async function stop({ fps = 60 } = {}) {
    recording = false
    await session.send("Page.stopScreencast")
    // Resample onto an exact 60fps grid: each output frame shows the latest capture
    // at its time. (ffmpeg's concat input rounds timestamps to 1/25s, which dropped
    // and doubled frames mid-animation.)
    const count = Math.floor((times.at(-1) - times[0]) * fps) + 1
    let source = 0
    for (let index = 0; index < count; index++) {
      const time = times[0] + index / fps
      while (source + 1 < times.length && times[source + 1] <= time) source++
      linkSync(`${dir}/raw/${source}.jpg`, `${dir}/${String(index).padStart(5, "0")}.jpg`)
    }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(fps), "-i", `${dir}/%05d.jpg`, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", outFile])
    rmSync(dir, { recursive: true, force: true })
    const span = times.length > 1 ? times.at(-1) - times[0] : 0
    return { frames: times.length, seconds: span, fps: times.length / (span || 1) }
  }
}
