import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces"
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans"

// The game's own palette and type, so the trailer reads as the same world.
export const COLORS = {
  table: "#2f2a26",
  tableLight: "#3d3630",
  wood: "#a8683c",
  woodDark: "#5b3519",
  panel: "#f6ead0",
  panelDark: "#e8d7b2",
  ink: "#2b1d14",
  gold: "#f6c938",
  goldDark: "#b8860b",
  accent: "#c6283a",
  muted: "#8a7a66",
  royal: "#3b1a5c",
}

export const DISPLAY = loadFraunces("normal", { weights: ["900"], subsets: ["latin"] }).fontFamily
export const BODY = loadJakarta("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily

export type BeanKey = "blue" | "chili" | "stink" | "green" | "soy" | "black_eyed" | "red" | "wax" | "coffee" | "golden"

export const BEAN_NAMES: Record<BeanKey, string> = {
  blue: "Blue",
  chili: "Chili",
  stink: "Stink",
  green: "Green",
  soy: "Soy",
  black_eyed: "Black-eyed",
  red: "Red",
  wax: "Wax",
  coffee: "Coffee",
  golden: "Golden",
}

// How many of each card the 5-player deck holds, printed on the card.
export const BEAN_COPIES: Record<BeanKey, number> = {
  coffee: 22, blue: 20, chili: 18, stink: 16, green: 14, soy: 12, black_eyed: 10, red: 8, wax: 6, golden: 4,
}
