import { existsSync } from "node:fs"
import { Config } from "@remotion/cli/config"
import { chromium } from "playwright"

Config.setVideoImageFormat("jpeg")
Config.setJpegQuality(95)
Config.setEntryPoint("src/index.ts")

// Remotion's bundled headless shell never fires animation frames on this Mac, and
// full Chrome now and then captures a frame mid-layout (tiled or missing text).
// Playwright's own headless shell, installed next to its Chrome, renders cleanly.
const chrome = chromium.executablePath()
const shell = chrome
  .replace(/chromium-(\d+)\/.*$/, "chromium_headless_shell-$1/chrome-headless-shell-mac-arm64/chrome-headless-shell")
Config.setBrowserExecutable(existsSync(shell) ? shell : chrome)
