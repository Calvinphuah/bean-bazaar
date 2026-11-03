// Bundled for Node so the capture scripts can fast-forward seeded games to each shot.
export { Game, SimpleBot, SmartBot, NormalBot, seededRandom } from "../../src/engine"
export { createGame, makeMove } from "../../src/games/services"
export { engineOf, botRunner, HUMAN_INDEX } from "../../src/games/games"
