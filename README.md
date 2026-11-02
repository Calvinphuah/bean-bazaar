# Bean Bazaar

A bean-trading card game for 1 player against 2 to 4 bots, playable right in the browser. Plant beans, trade with the table, and harvest your fields for coins. Whoever holds the most coins when the third season ends wins the bazaar.

This is the frontend-only version: the game rules and the bots run in your browser, with no server. Your game is saved in the browser, so a reload picks it up where you left it.

## How to play

- **Plant.** Every turn you must plant the front card of your hand. You may plant the next card too. You can never reorder your hand.
- **Fields.** Each field grows one bean type. A third field costs 3 coins.
- **Harvest.** Bigger piles pay more coins. You can't harvest a field holding just 1 bean while another field has more.
- **Flip and trade.** After planting, flip 2 cards from the deck and trade them, or cards from your hand, with the bots. Whatever you get or keep must be planted.
- **Bot turns.** Bots offer you deals on their turns. You can take the deal, turn it down, or make your own offer.
- **Seasons.** Each time the deck runs out, a new season starts. The game ends when the third season's deck runs out.

Press **Rules** in the game for a guided tour. Bots come in three levels: Easy, Normal and Smart. Games with 4 bots add the Coffee and Golden beans.

## Running it locally

You need Node 22.

```bash
npm ci
```

```bash
npm run dev
```

Then open http://localhost:5173.

## How it's built

- `src/engine`: the game rules and bots in plain TypeScript, with no Vue or browser code.
- `src/games`: starting games, checking your moves, undo and trade quotes, on top of the engine.
- `src/api.ts`: the calls the Vue app makes; they run the engine and save the game in `localStorage`.
- `src/components`: the Vue 3 app, built with Vite.
- `scripts/balance.sim.ts`: plays thousands of games with a scripted player to check how often each bot level loses.

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Bot balance (takes a few minutes):

```bash
npm run sim
```

Set `SIM_GAMES`, `SIM_LEVELS` (`easy normal smart`) or `SIM_MODES` (`notrade pro allbots smartbot`) to change what it plays.

## Deploying

The site is static files, so any static host works. See [docs/cloudflare-pages.md](docs/cloudflare-pages.md) for Cloudflare Pages on your own subdomain.

## Credits

- Sound effects: "Casino Audio" by [Kenney](https://www.kenney.nl), CC0.
- Card and character art made for this game.
