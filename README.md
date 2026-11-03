<div align="center">

# Bean Bazaar

**Adorable beans. Ruthless trading.**

A bean-trading card game for 1 player against 2 to 4 bots, right in your browser.

[![Bean Bazaar trailer: click to watch](docs/media/trailer-preview.gif)](docs/media/trailer.mp4)

### [▶ Play free in your browser](https://bean-bazaar.calvinphuah.com) · [🎬 Watch the trailer](docs/media/trailer.mp4)

No download, no sign-up. Your game saves in the browser, so a reload picks it up where you left it.

</div>

## Meet the beans

<p align="center">
  <img src="public/cards/blue-240.webp" width="120" alt="Blue Bean">
  <img src="public/cards/chili-240.webp" width="120" alt="Chili Bean">
  <img src="public/cards/stink-240.webp" width="120" alt="Stink Bean">
  <img src="public/cards/soy-240.webp" width="120" alt="Soy Bean">
  <img src="public/cards/red-240.webp" width="120" alt="Red Bean">
  <img src="public/cards/golden-240.webp" width="120" alt="Golden Bean">
</p>

Ten hand-painted beans, from the Blue Bean playing sax in the rain to the Golden Bean lounging on a velvet cushion. There are only four Golden beans in the deck.

## How it plays

![A game in progress: Lima offers a Green bean for one of your beans](docs/media/table.jpg)

- **Plant.** Every turn you must plant the front card of your hand. You may plant the next card too. You can never reorder your hand.
- **Fields.** Each field grows one bean type. A third field costs 3 coins.
- **Harvest.** Bigger piles pay more coins. You can't harvest a field holding just 1 bean while another field has more.
- **Flip and trade.** After planting, flip 2 cards from the deck and trade them, or cards from your hand, with the bots. Whatever you get or keep must be planted.
- **Bot turns.** Bots offer you deals on their turns. You can take the deal, turn it down, or make your own offer.
- **Seasons.** Each time the deck runs out, a new season starts. The game ends when the third season's deck runs out, and the most coins wins.

Press **Rules** in the game for a guided tour.

## The bots

Four bots sit at the table, each with their own way of trading:

| Bot | Says no with | Plays |
| --- | --- | --- |
| Pinto | "Sorry, friend" | Generous: happy to give and take gifts |
| Lima | "Do better" | Shrewd: won't feed whoever is winning |
| Fava | "Mine, all mine" | Collector: guards the bean of its biggest field |
| Mung | "Not worth the risk" | Gambler: digs up fields to chase a new bean |

Bots come in three levels: Easy, Normal and Smart. Games with 4 bots add the Coffee and Golden beans.

---

## For developers

The game rules and the bots run in your browser, with no server.

### Running it locally

You need Node 22.

```bash
npm ci
```

```bash
npm run dev
```

Then open http://localhost:5173.

### How it's built

- `src/engine`: the game rules and bots in plain TypeScript, with no Vue or browser code.
- `src/games`: starting games, checking your moves, undo and trade quotes, on top of the engine.
- `src/api.ts`: the calls the Vue app makes; they run the engine and save the game in `localStorage`.
- `src/components`: the Vue 3 app, built with Vite.
- `scripts/balance.sim.ts`: plays thousands of games with a scripted player to check how often each bot level loses.
- `trailer/`: the launch trailer, built in Remotion. See [trailer/README.md](trailer/README.md).

### Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Bot balance (takes a few minutes):

```bash
npm run sim
```

Set `SIM_GAMES`, `SIM_LEVELS` (`easy normal smart`) or `SIM_MODES` (`notrade pro allbots smartbot`) to change what it plays.

### Deploying

The site is static files, so any static host works. See [docs/cloudflare-pages.md](docs/cloudflare-pages.md) for Cloudflare Pages on your own subdomain.

## Credits

- Sound effects: "Casino Audio" by [Kenney](https://www.kenney.nl), CC0.
- Card and character art made for this game.
- Trailer music and sound: see [trailer/public/audio/CREDITS.txt](trailer/public/audio/CREDITS.txt).
