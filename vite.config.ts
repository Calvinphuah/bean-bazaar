import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      // Balance sims take minutes, so they only run with `npm run sim`.
      { extends: true, test: { name: "sim", include: ["scripts/**/*.sim.ts"], testTimeout: 0 } },
    ],
  },
})
