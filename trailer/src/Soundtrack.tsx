import { Audio, Sequence, interpolate, staticFile } from "remotion"
import { BEAT, DURATION, FPS, SECTIONS, TRACK_SECONDS, at, beats, phraseStart } from "./timeline"

// Where each sound's hit lands inside its file (measured), so the hit, not the
// file start, lines up with the cut.
const SOUNDS = {
  whoosh_long: { hit: 2.64, gain: 0.55 },
  whoosh_bright: { hit: 4.04, gain: 0.4 },
  riser_wildfire: { hit: 4.88, gain: 0.7 },
  riser_hit: { hit: 1.84, gain: 0.75 },
  impact_e: { hit: 0.2, gain: 0.8 },
  braam_drop: { hit: 0.6, gain: 0.55 },
  stab: { hit: 0.08, gain: 0.35 },
  stamp: { hit: 0.6, gain: 0.9 },
  card_slap: { hit: 0.2, gain: 0.9 },
  cartoon_slap: { hit: 0.08, gain: 0.5 },
  card_take: { hit: 0.2, gain: 1 },
  page_shuffle: { hit: 1.04, gain: 0.7 },
  riffle_shuffle: { hit: 0.8, gain: 0.8 },
  coin_pile: { hit: 0.32, gain: 0.9 },
  coins_box: { hit: 0.16, gain: 0.7 },
  coin_spin: { hit: 0.28, gain: 0.7 },
  coins_spill: { hit: 0.76, gain: 0.9 },
  coins_clink: { hit: 1.52, gain: 0.9 },
  creak: { hit: 2.92, gain: 0.6 },
  sparkle_long: { hit: 1.2, gain: 0.6 },
  mystical_chime: { hit: 0.92, gain: 0.8 },
  magic_impact: { hit: 0.4, gain: 0.6 },
  bazaar_crowd: { hit: 0, gain: 0.1 },
} as const
export type Sound = keyof typeof SOUNDS

export interface Cue {
  sound: Sound
  // The frame the sound's hit should land on.
  frame: number
  gain?: number
  // Plays only this many seconds, fading out at the end (for long files).
  seconds?: number
}

const Sfx: React.FC<{ cue: Cue }> = ({ cue }) => {
  const { hit, gain } = SOUNDS[cue.sound]
  const lead = Math.round(hit * FPS)
  const start = cue.frame - lead
  const length = cue.seconds ? Math.round(cue.seconds * FPS) + lead : undefined
  const volume = (frame: number) => (cue.gain ?? 1) * gain * (length ? interpolate(frame, [length - 20, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1)
  return (
    <Sequence from={Math.max(0, start)} durationInFrames={length} layout="none">
      <Audio src={staticFile(`audio/sfx/${cue.sound}.mp3`)} trimBefore={start < 0 ? -start : 0} volume={volume} />
    </Sequence>
  )
}

const MUSIC = staticFile("audio/music/tread_heavily.mp3")
const MUSIC_GAIN = 0.8
const EDGE = 3

// One stretch of the track placed in the trailer, with tiny fades so joins never click.
const MusicCut: React.FC<{ from: number; phrase: number; length: number; fadeOut?: number }> = ({ from, phrase, length, fadeOut = EDGE }) => (
  <Sequence from={from} durationInFrames={length} layout="none">
    <Audio
      src={MUSIC}
      trimBefore={Math.round(phraseStart(phrase) * FPS)}
      volume={(frame) => MUSIC_GAIN * interpolate(frame, [0, EDGE, length - fadeOut, length], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  </Sequence>
)

export const Soundtrack: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const phrase = beats(16)
  const tail = Math.round((TRACK_SECONDS - phraseStart(SECTIONS.logo.phrase)) * FPS)
  return (
    <>
      <MusicCut from={at("meet")} phrase={SECTIONS.meet.phrase} length={phrase * 3} />
      {/* The breakdown drops out a beat early, leaving silence before the drop. */}
      <MusicCut from={at("squeeze")} phrase={SECTIONS.squeeze.phrase} length={phrase - beats(1)} fadeOut={Math.round(BEAT * FPS * 0.5)} />
      <MusicCut from={at("drop")} phrase={SECTIONS.drop.phrase} length={phrase * 2 + tail} fadeOut={30} />
      <Sequence from={0} durationInFrames={DURATION} layout="none">
        <Audio src={staticFile("audio/sfx/bazaar_crowd.mp3")} volume={(frame) => SOUNDS.bazaar_crowd.gain * interpolate(frame, [0, 30, at("meet"), at("meet") + 60, DURATION - 90, DURATION], [0, 1.6, 1.6, 0.5, 0.5, 0], { extrapolateRight: "clamp" })} loop />
      </Sequence>
      {cues.map((cue, index) => <Sfx key={index} cue={cue} />)}
    </>
  )
}
