# Family Feud Day-of Runbook

> Deployed URL: `https://<your-cloudfront-url>` — fill in after deploy.

---

## Pre-event setup (do 30 min before doors open)

1. Connect projector via HDMI. In display settings: **Extend (not Mirror)**. Set projector to 1920×1080 if available.
2. On the host laptop, open Chrome and navigate to `https://<cloudfront-url>/admin`
3. Click **"Open Projector Window"** — a new browser window opens on the same screen.
4. Drag the new window to the projector display, then press **F11** (Windows) or **Cmd-Shift-F** (Mac) to fullscreen.
5. Click anywhere on the projector window to dismiss the splash screen and **unlock audio**.
6. Test audio: in admin, reveal an answer — you should hear the ding through the PA.
7. Test view switch: click the bracket glyph (trophy icon) in admin top-right; projector switches to bracket. Switch back to game (TV icon).

---

## Running a tournament

### Setup phase
1. Register 6 teams in admin → **Start Tournament**
2. Bracket is automatically generated. Switch projector to bracket view to show it.

### Each match
1. Click **Face-Off** — note which team won the face-off; click their button.
2. Reveal answers with the numbered buttons on the board.
3. If a strike occurs, click **Mark Strike** — the X overlay fires on projector with sound.
4. When all revealed (or 3 strikes), use **Award Points** or **Start Steal**.
5. When match is complete, click **Advance Match** — confirmation modal fires.

### Between matches
- Switch projector to bracket view (**B** hotkey) to show standings while teams swap.
- Switch back to game view (**G** hotkey) when the next match starts.

### Semifinals & Final
- Same flow. Wildcard team will appear automatically once all Round 1 matches complete.

### Fast Money (Final)
1. After the Final match, click **Fast Money** in admin.
2. Player 1 answers questions live — click **Start Timer** in admin, host reads questions aloud.
3. Click **Submit Player 1 Answers** when done.
4. Player 1 is escorted to a soundproof area (or headphones). Player 2 answers same questions.
5. Click **Submit Player 2 Answers** — projector shows the reveal with score count-up.
6. If total ≥ 200: **YOU WIN!** with champion fanfare. If not: red "NOT ENOUGH" message.

---

## Hotkeys (admin window must be focused)

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + Z` | Undo last action |
| `G` | Switch projector to game-mode view |
| `B` | Switch projector to bracket view |

---

## If something breaks

| Problem | Fix |
|---------|-----|
| **Browser crashes** | Reopen `/admin`, the state auto-resumes from DynamoDB (or localStorage in dev) |
| **Projector window closes** | Click "Open Projector Window" in admin again, drag to projector display |
| **Audio stops working** | Reload the projector window, then click anywhere on it to re-unlock |
| **State seems stale on projector** | The projector polls every 3s; wait a moment. If consistently stale, reload projector window. |
| **Green dot in admin footer is red** | Lost AWS/DynamoDB connection. Check WiFi. Wait ~10s for auto-retry. |
| **Misclick** | `Cmd/Ctrl+Z` undoes last action. If it can't be undone, the confirmation modal will have prevented most mistakes. |

---

## Audio notes

The audio system unlocks on the first user click (browser autoplay policy requirement).
If placeholder `.mp3` files haven't been replaced, audio will silently fail — the game still works fine, just without sound.

To source audio before the event:
- See `public/audio/README.md` for the full list of required clips and where to find them.
- After downloading, rebuild with `npm run build` and redeploy.

---

## Post-event cleanup

No cleanup needed. Tournament data stays in DynamoDB for reference. The `tournamentId` key in localStorage can be cleared to start fresh next time.
