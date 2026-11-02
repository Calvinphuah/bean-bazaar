import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    vue(),
    // The whole game runs in the browser, so caching every file lets it play offline.
    // A new deploy waits until the player chooses to reload, never mid-move.
    VitePWA({
      registerType: "prompt",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,webp,png,svg,mp3,webmanifest}"],
        // Install-dialog pictures only; no need to download them for play.
        globIgnores: ["screenshots/**"],
        // The two game fonts come from Google, so keep a copy for offline play.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
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
