import { execFileSync, spawnSync } from "node:child_process"
import { statSync } from "node:fs"

// Turns the rendered trailer into the three deliverables:
// - out/trailer-master.mp4: full quality, audio mastered to YouTube's -14 LUFS
// - out/trailer-readme.mp4: 720p, under 10 MB, for the GitHub README
// - out/golden-loop.gif: the Golden reveal and harvest, looping
const SOURCE = process.env.SOURCE ?? "out/trailer-render.mp4"
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" })
const mb = (file) => (statSync(file).size / 1e6).toFixed(1)

// Two-pass loudness: measure first, then correct with the measured values so the
// mix isn't pumped. Peaks stay under -1 dBTP.
const TARGET = "I=-14:TP=-1:LRA=11"
// loudnorm prints its measurements as JSON on stderr.
const report = spawnSync("ffmpeg", ["-hide_banner", "-i", SOURCE, "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr
const stats = JSON.parse(report.match(/\{[\s\S]*\}/)[0])
const second = `loudnorm=${TARGET}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`
ffmpeg("-i", SOURCE, "-c:v", "copy", "-af", second, "-ar", "48000", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "out/trailer-master.mp4")
console.log(`master: out/trailer-master.mp4 (${mb("out/trailer-master.mp4")} MB), input was ${stats.input_i} LUFS`)

// README copy: 720p30, two-pass to a size budget of about 9 MB.
const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "out/trailer-master.mp4"], { encoding: "utf8" }))
const audioKbps = 96
const videoKbps = Math.floor((9 * 8 * 1000) / seconds - audioKbps)
const scale = ["-vf", "scale=1280:720:flags=lanczos,fps=30"]
ffmpeg("-i", "out/trailer-master.mp4", ...scale, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoKbps}k`, "-pass", "1", "-passlogfile", "out/readme-pass", "-an", "-f", "mp4", "/dev/null")
ffmpeg("-i", "out/trailer-master.mp4", ...scale, "-c:v", "libx264", "-preset", "slow", "-b:v", `${videoKbps}k`, "-pass", "2", "-passlogfile", "out/readme-pass", "-c:a", "aac", "-b:a", `${audioKbps}k`, "-movflags", "+faststart", "out/trailer-readme.mp4")
console.log(`readme: out/trailer-readme.mp4 (${mb("out/trailer-readme.mp4")} MB)`)

// The GIF: the Golden reveal through the Get Rich harvest, the drop's first six
// beats (cold open is 4 beats, then the drop is the fifth 16-beat section).
const BEAT = 60 / 95.7
const start = (4 + 4 * 16) * BEAT
const length = 6 * BEAT
const gif = "fps=15,scale=640:-1:flags=lanczos"
ffmpeg("-ss", String(start), "-t", String(length), "-i", "out/trailer-master.mp4", "-vf", `${gif},palettegen=stats_mode=diff`, "out/palette.png")
ffmpeg("-ss", String(start), "-t", String(length), "-i", "out/trailer-master.mp4", "-i", "out/palette.png", "-lavfi", `${gif}[x];[x][1:v]paletteuse=dither=sierra2_4a`, "-loop", "0", "out/golden-loop.gif")
console.log(`gif: out/golden-loop.gif (${mb("out/golden-loop.gif")} MB)`)
