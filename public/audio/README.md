# Audio Assets — TO SOURCE

These are placeholder files. Replace with actual CC0 audio clips before the event.

## Required clips

| Filename | Description | Suggested length | Source |
|----------|-------------|------------------|--------|
| `reveal-ding.mp3` | Bright bell ding when an answer is revealed | < 1s | freesound.org "ding bell short" |
| `strike-sting.mp3` | The iconic *EH-EHHH* (game-show error buzzer) | ~1s | freesound.org "buzzer wrong" |
| `match-end.mp3` | Upbeat short sting at match win | < 2s | freesound.org "victory short sting" |
| `champion-fanfare.mp3` | Longer fanfare for tournament champion | ~5s | freesound.org "fanfare trumpet" |
| `fm-tick.mp3` | Clock tick for last 10 seconds of Fast Money | < 0.5s | freesound.org "clock tick" |
| `fm-time-up.mp3` | Buzzer for FM time expiring | < 1s | freesound.org "buzzer end short" |

All clips should be CC0 / royalty-free. Total combined size target: under 2 MB.

## How to drop in

1. Download from freesound.org (or your CC0 source of choice).
2. Save with the exact filenames above.
3. Place in this directory (`public/audio/`).
4. Rebuild: `npm run build`.

The audio system will load each from `/audio/<filename>` at runtime.
