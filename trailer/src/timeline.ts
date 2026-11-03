// Every cut sits on the music's beat grid, measured from the track:
// "Tread Heavily" runs at 95.7 BPM, its first beat at 0.124s, in 16-beat phrases.
export const FPS = 60
export const WIDTH = 1920
export const HEIGHT = 1080

export const BEAT = 60 / 95.7
const FIRST_BEAT = 0.124
const PHRASE = 16 * BEAT
export const TRACK_SECONDS = 145.39

// Where phrase n of the track starts, in track seconds.
export const phraseStart = (n: number): number => FIRST_BEAT + n * PHRASE

// The trailer: a silent cold open, then one music phrase per section.
// The edit jumps from phrase 2 to the breakdown (5), and from there to the climax (12).
export const COLD_OPEN_BEATS = 4
export const SECTIONS = {
  meet: { phrase: 0 }, // the beans, one card per two beats
  play: { phrase: 1 }, // plant, trade, harvest
  bazaar: { phrase: 2 }, // the bots and their haggling
  squeeze: { phrase: 5 }, // last season, deck running out
  drop: { phrase: 12 }, // the Golden beans
  payoff: { phrase: 13 }, // the win and the tagline
  logo: { phrase: 14 }, // the end card, to the end of the track
} as const
export type Section = keyof typeof SECTIONS
const ORDER: Section[] = ["meet", "play", "bazaar", "squeeze", "drop", "payoff", "logo"]

const sectionSeconds = (section: Section): number => (COLD_OPEN_BEATS + ORDER.indexOf(section) * 16) * BEAT

// The frame of beat `beat` (fractions allowed) within a section; beat 0 is the downbeat.
export const at = (section: Section, beat = 0): number => Math.round((sectionSeconds(section) + beat * BEAT) * FPS)
// The frame of beat `beat` of the cold open.
export const cold = (beat: number): number => Math.round(beat * BEAT * FPS)
export const beats = (count: number): number => Math.round(count * BEAT * FPS)
export const seconds = (value: number): number => Math.round(value * FPS)

const LOGO_SECONDS = TRACK_SECONDS - phraseStart(SECTIONS.logo.phrase)
const TAIL_SECONDS = 1.2
export const DURATION = Math.round((sectionSeconds("logo") + LOGO_SECONDS + TAIL_SECONDS) * FPS)
