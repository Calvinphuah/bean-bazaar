// Bundles the game engine for Node; run with `npm run engine`.
export default { publicDir: false, build: { ssr: "capture/engine-entry.ts", outDir: ".engine", emptyOutDir: true } }
