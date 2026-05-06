# EGPS Family Feud — Design Spec

**Status:** Draft for review
**Date:** 2026-05-05
**Author:** Douglas Linsmeyer (with Claude)

## 1. Overview

A web-based Family Feud game for an in-person EGPS company conference event. ~50 attendees, ~75–90 minutes, six teams playing a single-elimination bracket tournament with a wildcard, ending with Fast Money.

**Success criteria:**
1. The host can run the entire tournament from one laptop with no out-of-band tools or spreadsheets — every action lives in the admin window.
2. The audience experience reads as Family Feud at first glance — gold board, royal-blue background, X-strikes, dramatic reveals — even to colleagues who haven't been told what's coming.
3. The product survives a browser crash, refresh, or accidental tab-close mid-tournament without losing state.

**Explicit non-goals:**
- Multi-device player participation (no phone-as-buzzer).
- Reusable / multi-tournament / multi-tenant capability — this is a single-event tool.
- Mobile-responsive layout.
- User accounts / authentication beyond what's required to write to DynamoDB.

## 2. Format

### Tournament structure

6 teams form at the event. Single-elimination bracket with a wildcard:

- **Round 1:** Three matches: T1 vs T2, T3 vs T4, T5 vs T6. Three winners advance.
- **Wildcard:** Highest-scoring losing team from Round 1 advances as the 4th semifinalist.
- **Semifinals:** Two matches. Semi 1 = R1 winner A vs R1 winner B. Semi 2 = R1 winner C vs Wildcard.
- **Final:** Two semifinal winners. Followed immediately by Fast Money.

### Match rules (standard TV)

Each match plays **1–2 questions** (host's choice; default 1, two if score is tied or audience energy demands it).

Per question:
1. **Face-off** — one player from each team comes to the front. Host reads the question. Players hit physical buzzers (real game-show buzzers — standalone noisemakers, not USB inputs). Host adjudicates who buzzed first and clicks the winning team's button on screen.
2. **First answer** — the buzzed-in player gives an answer. Host clicks the matching answer on the board to reveal it (or marks "wrong" if it's not on the board).
3. **Decide control** — if the buzzing team's first answer is the #1 answer (highest points on the board), they play. Otherwise the opposing player gets one guess to beat that answer. The team with the higher revealed answer wins control of the board.
4. **Play the board** — the controlling team takes turns guessing answers. Each correct answer is revealed; each wrong answer is a strike. **3 strikes** ends the team's turn.
5. **Steal** — opposing team gets one guess to "steal" all the points on the board. Correct → opposing team wins the question's points. Wrong → controlling team keeps the points.
6. **Award points** — host clicks "Award revealed points to [active team]." Points add to the team's match total.

**Win the match:** highest match total after all questions in the match are played. (Default 1 question; configurable per match.)

### Fast Money (final round only)

After the final match has a winner, the winning team plays Fast Money:
- 2 players from the winning team
- Player 1: **30 seconds**, 5 questions, give the top answer to each
- Player 2: leaves the room while Player 1 plays. Returns. **25 seconds**, same 5 questions, can't repeat Player 1's answers
- **Goal: 200 points combined** to win the grand prize
- Each answer is worth its survey-count (so the same scoring as the main game)

## 3. Architecture

### Hosting and infrastructure

- **AWS S3 + CloudFront** — static SPA, served from CloudFront. ACM cert if a custom domain is wired up later (not required for MVP — default CloudFront URL works).
- **Amazon DynamoDB** — single table holds the tournament state. One record per tournament, keyed by tournament ID (auto-generated). State is stored as a structured JSON blob (bracket + matches + scores + revealed-answers + which-questions-used).
- **Amazon Cognito Identity Pool** — unauthenticated identity pool issues temporary AWS credentials so the SPA can write directly to DynamoDB without a backend. IAM policy locks writes to the active tournament row.
- **No Lambda, no API Gateway, no AppSync** — the SPA talks to DynamoDB directly via the AWS SDK v3. Keeps the moving parts to a minimum.
- **Infrastructure as code:** AWS CDK in TypeScript (matches the frontend stack, lets us share types if useful).

### Dual-window operation

The host laptop has the projector configured as an **extended display** (not mirrored). The host runs **two browser windows**:

1. **Admin window** on the laptop screen. Opens at `/admin`. Always shows the admin view. Never on the projector.
2. **Projector window** on the extended display. Opens at `/projector`. Shows either the **game-mode view** or the **bracket view** depending on what the host has selected from admin. No chrome, no controls — pure audience-facing.

Both windows read the same DynamoDB tournament record. The admin window writes; the projector window polls (~500ms–1s interval) for changes.

The first-launch admin view has an **"Open Projector Window"** button that pops the projector window into a new browser window. The host drags it to the extended display and (manually or via a single click) goes fullscreen.

### State sync model

- **Single-writer:** only the admin window writes to DynamoDB.
- **Optimistic local update:** admin window updates its own UI immediately, then writes to DDB. Failed writes show a warning and roll back.
- **Polling-based read:** projector window polls DDB every 750ms for tournament-state changes. This is fast enough for human-perceived "live" and cheap enough that an evening's read traffic is negligible (DDB on-demand pricing).
- **Conflict policy:** none required — single-writer means no conflicts.

### Refresh resilience

Both windows reload from DDB on page load. A browser crash, accidental tab close, or laptop reboot does not lose tournament progress: the host re-opens the URL and is back where they were.

The active tournament ID is stored in `localStorage` so reopening the URL automatically resumes the in-progress tournament. A pre-game admin screen offers "Resume in-progress tournament" or "Start new tournament."

## 4. Views

All three views share a common visual register: deep royal-blue gradient background (`#0a1d4f → #061236`), gold panels (`#ffd700 → #ffaa00`), red X-strikes (`#cc0000`), Bebas Neue + Fjalla One typography. Faithful homage to the Steve Harvey-era *Family Feud* TV set — the audience reads "Family Feud" within seconds of seeing the projector.

### 4.1 Game-mode view (projector)

Layout (locked from wireframes):

- **Top:** the question prompt in big glowing all-caps Bebas Neue, visible for the entire round. (Picked over the alternative of fading to a small caption — corporate room benefits from latecomers being able to read the prompt.)
- **Middle:** 5-row gold answer board. Each row shows a number (1–5) when hidden, the answer text + point value in gold gradient when revealed. Reveal animation: panel flips with a brief delay between answers.
- **Bottom:** scoring bar — `[Team A panel] [3 X strike slots] [Team B panel]`. Active team has a brighter glow + white border. Strike slots light up red as strikes accumulate.

Transient states:
- **Strike overlay:** when a wrong answer is marked, a giant red `X` slams over the whole screen for ~1.2s with the *EH-EHHH* sting, then clears. Active team's strike slot lights up at the same moment.
- **Match-over cue:** when win condition is met, the leading team's panel gets a brighter pulsing halo and a small "WINNER" / "MATCH" tag. Subtle enough not to disrupt the audience moment, visible enough that the host catches it from the projector.

### 4.2 Bracket view (projector)

Layout (locked from V5 wireframe):

- **Title row:** "EGPS FAMILY FEUD · TOURNAMENT BRACKET"
- **Round headers row:** "ROUND 1 · SEMIFINALS · FINAL" — three columns aligned with the tree below.
- **Tree:** 3 columns left → right.
  - Round 1 column: 4 cards stacked — Match 1, Match 2, Match 3, Wild Card. M1+M2 paired (top), M3+WC paired (bottom). Wild Card slot has a dashed purple border to distinguish it.
  - Semifinals column: 2 cards (Semi 1, Semi 2), vertically aligned with the pair midpoints.
  - Final column: 1 card, centered vertically.
- **Connectors:** 4px gold L-shapes drawn with CSS pseudo-elements (no SVG hardcoded coordinates). Sized by relationship (25%/75% endpoints inside each pair) so they align by construction.
- **Match cards:** show both teams + scores. Winner row has gold-gradient fill; loser row is dimmed with strikethrough on team name and score. Live match (in-progress) has a pulsing white border + small "LIVE" pill. The wildcard team's appearance in their semifinal carries a small purple "★ WC" pill before their team name.
- **Footnote:** small italic purple text in the bottom-right — "★ WILD CARD: highest-scoring losing team from Round 1." Build-time tweak: bump the font size — V5 had it slightly too small.

### 4.3 Admin view (laptop)

Always-on. Two main responsibilities: control what the projector shows, and drive the in-match scoring/state.

Persistent chrome:
- **Top bar:** current match context (e.g., "Semi 2 · Foxtrot vs Bravo") + two glyph buttons in the top-right (game-mode / bracket). The active glyph is gold-lit, the other dim. Clicking the dim one switches the projector window's view.
- **Footer:** sync status indicator + "↶ Undo" button + hotkey hint (`⌘Z` / `Ctrl+Z`).

Body layout for in-match state (the most common state):
- **Left:** current question + clickable answer board. Each hidden row shows the answer + point value in dim text with a "click to reveal" hint. Clicking reveals the answer on both admin and projector.
- **Right:** team panels (click-to-flip-active), 3 strike slots (click to add/remove strikes), action buttons (`+ Award Revealed Points to Active`, `✗ Wrong Answer (Strike)`, `↺ Skip Question`), and a big green pulsing "→ NEXT MATCH" CTA that lights up when the win condition is met. The **steal screen fires automatically** when the active team accumulates the 3rd strike — host doesn't have to remember to trigger it.

Other admin states (sub-screens within the admin window — design follows the same chrome):
- **Pre-game / Setup** — registration form for 6 teams (team name + 4–5 player names) + "Start Tournament" button + "Open Projector Window" button.
- **Face-off** — appears when a new question begins. Two large clickable team buttons centered on the screen ("ALPHA buzzed first" / "BRAVO buzzed first"). Host clicks whichever team hit their physical buzzer first. Resolves to the in-match view.
- **Steal attempt** — modal-style screen with two buttons: "✓ Steal SUCCESSFUL — points to opposing team" / "✗ Steal FAILED — points stay with controlling team."
- **Between matches** — confirmation/celebration. Shows match result, winner, and the next match preview. "Advance to [next match]" button.
- **Fast Money** — two-screen flow. Player 1 screen: 30s timer, 5 question rows, host types each answer + clicks "Submit answer" (or selects from suggested top-5). Player 2 screen: same but 25s, with Player 1's answers shown grayed out (can't repeat). Final reveal: total points, "200+" celebration if won.

## 5. Game flow / state machine

Tournament proceeds through these states:

```
SETUP → R1_M1 → R1_M2 → R1_M3 → SEMI_1 → SEMI_2 → FINAL → FAST_MONEY → DONE
```

Within each match state:
```
FACE_OFF → BOARD_PLAY → (STEAL?) → AWARD_POINTS → MATCH_END → (advance)
```

Action stack for undo: each in-match action (reveal answer, mark strike, switch active team, award points, mis-buzz) pushes onto a stack. Undo pops and reverses. Stack resets on match advance (which fires after a confirmation modal).

After Round 1 completes, the system computes the wildcard automatically (highest losing team's score) and advances to Semi 2's setup with the wildcard slotted in.

## 6. Data model

Single DynamoDB table, single item per tournament:

```typescript
type TournamentState = {
  tournamentId: string;          // partition key
  createdAt: number;
  status: 'setup' | 'in_progress' | 'done';
  teams: Team[];                 // 6 entries; team name + player names
  bracket: {
    round1: Match[];             // 3 matches
    wildcard: { teamId: string | null; score: number | null };
    semis: Match[];              // 2 matches
    final: Match | null;
    fastMoney: FastMoneyResult | null;
    champion: string | null;     // teamId
  };
  currentMatchPath: string | null; // e.g. "semis.0", "round1.2", "final"
  currentMatchState: MatchState;   // face-off, board-play, etc.
  questionPool: { used: string[]; available: string[] };
  fastMoneyPool: { used: string[]; available: string[] };
  projectorView: 'game' | 'bracket'; // which the projector window should show
  actionStack: Action[];          // for undo within current match; opaque action descriptors with a discriminated union (REVEAL_ANSWER | MARK_STRIKE | AWARD_POINTS | SWITCH_ACTIVE | …)
  updatedAt: number;
};

type Match = {
  teamAId: string;
  teamBId: string;
  questions: QuestionPlay[];      // usually length 1, sometimes 2
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  isWildcardEntry?: boolean;      // true on semi 2's bottom slot
};

type QuestionPlay = {
  questionId: string;
  revealedAnswers: number[];      // indices 0–4
  strikesA: number;
  strikesB: number;
  activeTeamId: string;
  pointsAwardedTo: string | null;
};
```

Question content is shipped in the SPA bundle (no need to read from DDB) — it's small (25 prompts) and never changes mid-event.

## 7. Build setup

### Repository

- **GitHub repo:** `family-feud-game` (private, single user)
- **Branch model:** trunk-based (single `main` branch). Feature branches via worktrees if helpful, but the project is small enough that direct commits to `main` are fine for MVP.
- **Issues + Milestones:** GitHub Issues used for tracked work. One milestone per major slice (e.g., "MVP", "Polish"). Tasks broken down so independent pieces can run in parallel agents.

### Local dev

- `npm create vite@latest` (React + TypeScript template)
- `npm run dev` for local SPA
- A small `mock-ddb.ts` adapter for local dev so contributors can develop without AWS credentials. Real AWS in a `dev` deployment for end-to-end testing.

### Deployment

- AWS CDK app in `infra/` defines: S3 bucket, CloudFront distribution, DynamoDB table, Cognito identity pool with limited IAM policy.
- `npm run deploy` builds the SPA and pushes to S3 + invalidates CloudFront.
- One environment for now (`prod`) — there's no staging requirement for a single-night event. A `dev` stack can be added if useful for testing.

## 8. Audio

Software plays everything except the face-off buzz (physical buzzers handle that):

| Sound | When | Source |
|-------|------|--------|
| Reveal ding | Each answer revealed | CC0 / freesound.org |
| X-strike sting (*EH-EHHH*) | Wrong answer | CC0 / original synth |
| Round-end sting | Match win | CC0 / original |
| Win fanfare | Tournament champion declared | CC0 / original |
| Fast Money clock tick | Last 10s of each FM round | Generated tone |
| Optional bed music | During registration / between matches | CC0 instrumental |

All assets bundled with the SPA build. Total budget under ~10 MB. Audio played via plain `HTMLAudioElement` for one-shot SFX (simplest path); reach for the Web Audio API only if we need cross-clip mixing or precise timing for Fast Money. First user gesture on either window unlocks audio.

## 9. Visual design specifics

- **Palette:** background `#0a1d4f` → `#061236` (radial), gold `#ffd700` / `#ffaa00`, red `#cc0000`, white text accents.
- **Wildcard accent:** purple `#b86bff` / `#7a2bd6` — appears on the wildcard slot border, the WC team's pill in the semi, and the corner footnote on the bracket.
- **Typography:** display = Bebas Neue (numbers, scores, headers); body / answers = Fjalla One; admin chrome = Inter for legibility at small sizes.
- **Animations:** panel reveals (CSS transition + small flip rotation), strike X slam (Framer Motion scale + shake), pulsing live indicators (CSS keyframes), green CTA pulse (CSS keyframes). No physics-y animation needed.

## 10. Open questions / build-time decisions

These are intentionally deferred to build time — they don't gate design approval, but flagging here so they don't get lost.

1. **AWS profile / region** — host hasn't named a specific account or region. Pick at infra-bootstrap time.
2. **Bracket connector pixel polish** — V5 had small visible disconnects between connector segments. Tune at build.
3. **Wildcard footnote font size** — bumped slightly larger than V5 (V5 was a touch small).
4. **Hotkeys** — `G` / `B` for projector view switching, `Ctrl/Cmd+Z` for undo, possibly `Space` for "next" — propose a default set; user can sign off.
5. **Final fanfare animation** — championship celebration on the projector when the winner is declared. Confetti? Trophy reveal? Party physics? — open.
6. **Custom domain** — not required for MVP. CloudFront URL works for the event.

## 11. Out of scope (explicitly)

- Multi-device / phone-as-buzzer.
- Real-time WebSocket sync (DDB polling is sufficient for one writer + one reader).
- Question editing UI in admin (questions are baked into the build).
- Multi-tournament support / tournament archive.
- Authentication beyond Cognito's anonymous identity pool.
- Mobile / tablet layouts.
- Internationalization.
- Accessibility audit beyond reasonable defaults (target audience is in-room with a physical projector).

## 12. Risks

1. **Audio autoplay policy.** Browsers won't play audio until first user gesture. Mitigation: gate the projector view on a "Click to start" splash that arms the audio context.
2. **DDB polling cost on a long evening.** 750ms polling × 90 minutes = ~7,200 reads. At DDB on-demand pricing this is well under a dollar. Acceptable.
3. **Extended-display setup variability.** Some laptops require manual display config to use the projector as extended (not mirrored). Document this in a one-page event-day checklist for the host.
4. **Browser tab energy management.** A backgrounded projector window may throttle. Mitigation: project window stays foregrounded on the extended display (host doesn't need to interact with it).
5. **Single-night event = no real iteration possible.** Mitigation: do a full dry-run with 6 stand-in teams before the event.
