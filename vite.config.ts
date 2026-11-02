import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    vue(),
    // The whole game runs in the browser, so caching every file lets it play offline.
    // A new deploy swaps in on the next launch.
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,webp,png,svg,mp3,webmanifest}"],
      },
    }),
  ],
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      // Balance sims take minutes, so they only run with `npm run sim`.
      { extends: true, test: { name: "sim", include: ["scripts/**/*.sim.ts"], testTimeout: 0 } },
    ],
  },
})
