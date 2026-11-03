# Bean Bazaar trailer

A 69-second launch trailer built in [Remotion](https://www.remotion.dev), from the game's own art and UI.

## Beat map

The music is "Tread Heavily" (95.7 BPM, 16-beat phrases). Every cut and every action lands on its beat grid ([src/timeline.ts](src/timeline.ts)).

| Time | Section | Music | What happens |
| --- | --- | --- | --- |
| 0:00 | Cold open | silence | Three cards slap onto the table, one per beat |
| 0:02.5 | Meet the beans | phrase 1 (intro) | Seven cards, two beats each, with a character note, then the fan: "ADORABLE." |
| 0:12.5 | How it plays | phrase 2 | Staged play: PLANT, TRADE, HARVEST, then "Easy, right?" as the bots slide in |
| 0:22.6 | The bazaar | phrase 3 | "BUT RUTHLESS.", the four bots and their lines, then a haggle with Pinto |
| 0:32.6 | The squeeze | phrase 6 (breakdown) | Last season, the deck running out, Golden beans stacking, a glow, silence |
| 0:42.6 | The drop | phrase 13 (climax) | "STRIKE GOLD.", "GET RICH.", the bots trading, everyone cashing in, the coin race |
| 0:52.7 | Payoff | phrase 14 | The real win screen, "OUT-TRADE THE BAZAAR.", the cast piling onto the table |
| 1:02.7 | End card | phrase 15 (ending) | The market-stall sign drops in; "Play free in your browser" |

## How it is made

- **Staged gameplay** ([src/stage](src/stage)): the game's UI redrawn close up (table, fields, badges, buttons, plates, offer panel, cursor), so every move lands on its beat and caption. Each scene exports its action beats, which the captions and sounds use too.
- **Real footage** (the win screen and the blurred table behind the bot callouts) is filmed from one seeded game (seed 55): "You" collect all four Golden beans and win 14 to 13.
- **Motion design** ([src/components](src/components), [src/scenes](src/scenes)): stamped titles, the Golden reveal, the leaderboard and the end card.

## Rebuilding it

```bash
npm ci
npm run game      # build the game into .game-dist (for filming)
npm run engine    # bundle the engine for the shot director
npm run capture   # film the real-footage shots in 4K
npm run render    # out/trailer-render.mp4
npm run export    # master (-14 LUFS), README MP4 (<10 MB) and Golden GIF in out/
```

Filming needs no dev server: the built game is served to the browser through request routing, slowed down so every 4K frame is captured, then resampled to an exact 60fps.

## Credits

See [public/audio/CREDITS.txt](public/audio/CREDITS.txt).
