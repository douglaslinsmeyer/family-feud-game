# Audio Assets

These six SFX are **synthesized** by `scripts/generate-sfx.py` (pure Python +
numpy + stdlib `wave`, no external audio toolchain required). The script and
the generated WAVs are both committed so the project builds anywhere without
re-running synthesis.

## Clips

| Filename | Description | Duration |
|----------|-------------|---------:|
| `reveal-ding.wav` | Bright bell ding when an answer is revealed | ~0.7s |
| `strike-sting.wav` | The iconic *EH-EHHH* (game-show error buzzer) | ~1.1s |
| `match-end.wav` | Upbeat short sting at match win | ~1.2s |
| `champion-fanfare.wav` | Trumpet fanfare for tournament champion | ~3.4s |
| `fm-tick.wav` | Clock tick for last 10 seconds of Fast Money | ~0.1s |
| `fm-time-up.wav` | Buzzer for FM time expiring | ~0.9s |

Mono, 16-bit, 44.1 kHz. Total combined size ~650 KB.

## Regenerating

```bash
python3 scripts/generate-sfx.py
```

Edit the parameters at the top of each `gen_*` function to retune timbres,
durations, or musical content. The audio system loads each clip from
`/audio/<filename>` at runtime; paths are wired in `src/audio/audioTypes.ts`.

## Replacing with real recordings

If you'd rather use sourced/recorded audio (e.g. CC0 clips from freesound.org),
just drop files with the **same filenames** into this directory — any common
HTMLAudioElement-compatible format works (WAV, MP3, OGG). If you change the
extension, also update the paths in `src/audio/audioTypes.ts`.
