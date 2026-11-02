import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  server: {
    // Same-origin calls to the Rails API in development, so no CORS setup.
    proxy: { "/api": "http://localhost:3000" },
  },
})
