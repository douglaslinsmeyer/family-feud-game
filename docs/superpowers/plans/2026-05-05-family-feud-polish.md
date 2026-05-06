# EGPS Family Feud — Polish Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan A's minimal styling with the spec's full classic-TV-homage aesthetic, add the audio kit, build out Fast Money theatrics, and harden a few rough edges from the MVP.

**Architecture:** No structural changes — same React+Vite+TS app, same DDB persistence. This is a styling + UX polish layer that re-skins the views Plan A built, adds audio playback, animates the strike/reveal/win moments, and fills small functional gaps.

**Tech Stack:** Plan A's stack + Framer Motion (already installed) + HTMLAudioElement (no new deps).

**Reference spec:** `docs/superpowers/specs/2026-05-05-family-feud-game-design.md`
**Reference visual mockups:** the V5 bracket and game-mode-A wireframes in `.superpowers/brainstorm/<session>/content/` (saved for reference; mine these for exact CSS values).

**Prerequisite:** Plan A is merged and deployed. The walking skeleton works end-to-end.

---

## File Structure (additions to Plan A)

```
src/
├── audio/
│   ├── AudioContext.tsx       # Provides audio API + autoplay unlock
│   ├── useSfx.ts              # Hook: play(name)
│   └── assets/                # mp3/wav files for SFX
│
├── components/
│   ├── ConfirmModal.tsx       # Styled, replaces window.confirm()
│   ├── ProjectorChrome.tsx    # Wrapper for projector views (background, etc.)
│   └── BracketConnectors.tsx  # CSS pseudo-element connector logic
│
├── views/
│   ├── projector/
│   │   ├── GameModeView.css   # Full classic-TV styling
│   │   ├── BracketView.css    # V5 bracket layout
│   │   ├── StrikeOverlay.tsx  # Framer Motion strike-X overlay
│   │   ├── WinFanfare.tsx     # Champion celebration
│   │   └── ProjectorSplash.tsx # "Click to start" autoplay-unlock screen
│   │
│   └── admin/
│       └── AdminView.css      # Polished admin chrome
│
└── state/
    └── reducer.ts             # MODIFIED: add HYDRATE + START_FAST_MONEY actions
```

---

## Phase 1: MVP gap-fixes (Tasks 1–3)

### Task 1: Add `HYDRATE` action and fix resume-from-DDB flow

**Files:**
- Modify: `src/state/types.ts`, `src/state/reducer.ts`, `src/state/GameStateContext.tsx`, `tests/state/reducer.test.ts`

The Plan A resume path bootstrapped teams only — the rest of the bracket/scores/etc. were lost. Need a single action that replaces the entire state from a loaded DDB record.

- [ ] **Step 1: Add the action type**

In `src/state/types.ts`, extend the `Action` union:

```typescript
export type Action =
  // ... existing entries ...
  | { type: 'HYDRATE'; state: TournamentState };
```

- [ ] **Step 2: Failing test**

```typescript
describe('reducer: HYDRATE', () => {
  it('replaces state entirely from a snapshot', () => {
    const snapshot = startedTournament(); // has 6 teams + R1 set up
    const empty = init();
    const next = reducer(empty, { type: 'HYDRATE', state: snapshot });
    expect(next).toEqual(snapshot);
  });
});
```

- [ ] **Step 3: Implement** in `reducer.ts`:

```typescript
case 'HYDRATE': {
  return action.state;
}
```

Add to `StackedAction` exclusion in `types.ts`:

```typescript
export type StackedAction = Exclude<Action, { type: 'UNDO' } | { type: 'HYDRATE' }>;
```

- [ ] **Step 4: Replace the bootstrap-only logic in `GameStateContext.tsx`**

Inside the resume `useEffect`:

```typescript
useEffect(() => {
  const id = localStorage.getItem(STORAGE_KEY);
  if (id) {
    persistence.load(id).then(loaded => {
      if (loaded) dispatch({ type: 'HYDRATE', state: loaded });
    });
  } else {
    localStorage.setItem(STORAGE_KEY, state.tournamentId);
  }
}, []);
```

- [ ] **Step 5: Tests pass + commit**

```bash
git add src/state/ tests/state/
git commit -m "fix(state): HYDRATE action restores full state from DDB"
```

---

### Task 2: Add `START_FAST_MONEY` reducer action

**Files:**
- Modify: `src/state/types.ts`, `src/state/reducer.ts`, `tests/state/reducer.test.ts`

The MVP's FastMoneySubview had no real way to initialize the `bracket.fastMoney` record. Add a proper action.

- [ ] **Step 1: Type**

```typescript
| { type: 'START_FAST_MONEY' }
```

- [ ] **Step 2: Failing test**

```typescript
describe('reducer: START_FAST_MONEY', () => {
  it('initializes the fastMoney record', () => {
    const s = init();
    const next = reducer(s, { type: 'START_FAST_MONEY' });
    expect(next.bracket.fastMoney).toEqual({ player1: [], player2: [], totalScore: 0, won: false });
  });
});
```

- [ ] **Step 3: Implement**

```typescript
case 'START_FAST_MONEY': {
  return {
    ...state,
    bracket: {
      ...state.bracket,
      fastMoney: { player1: [], player2: [], totalScore: 0, won: false },
    },
    actionStack: [...state.actionStack, action],
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Update `FastMoneySubview` to dispatch this on mount when `state.bracket.fastMoney === null`**

In `FastMoneySubview.tsx`, replace the placeholder "Start Fast Money" button with a `useEffect` that auto-dispatches `START_FAST_MONEY` when the FM record is null.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/ src/views/admin/FastMoneySubview.tsx
git commit -m "feat(fast-money): START_FAST_MONEY action + auto-init"
```

---

### Task 3: Replace `window.confirm()` with styled `ConfirmModal`

**Files:**
- Create: `src/components/ConfirmModal.tsx`
- Modify: `src/views/admin/BetweenMatchesSubview.tsx`

- [ ] **Step 1: Modal component**

```typescript
import { useEffect } from 'react';

export function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--bg-card)', border: '3px solid var(--gold)', borderRadius: 8,
        padding: 32, maxWidth: 480, color: 'var(--gold)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Bebas Neue', letterSpacing: 2 }}>{title}</h2>
        <p style={{ color: 'white', margin: '16px 0' }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>{cancelLabel}</button>
          <button style={{ background: 'var(--green)', color: 'white', padding: '8px 16px' }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use in BetweenMatchesSubview** — replace `confirm()` calls.

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfirmModal.tsx src/views/admin/BetweenMatchesSubview.tsx
git commit -m "feat(ui): styled ConfirmModal replaces window.confirm"
```

---

## Phase 2: GameModeView visual polish (Tasks 4–7)

### Task 4: GameModeView — full classic-TV styling

**Files:**
- Create: `src/views/projector/GameModeView.css`
- Modify: `src/views/projector/GameModeView.tsx`

- [ ] **Step 1: CSS** — copy the structure from the approved game-mode-layout-A wireframe (Layout A: question stays visible). Reference the visual companion's `.gm-*` classes for exact spacing/colors. Key rules:

```css
/* src/views/projector/GameModeView.css */
.gm-stage {
  width: 100vw; height: 100vh;
  background: linear-gradient(180deg, #0a1d4f 0%, #061236 100%);
  font-family: 'Fjalla One', sans-serif;
  display: flex; flex-direction: column;
  padding: 32px 48px;
}
.gm-question {
  font-family: 'Bebas Neue';
  font-size: clamp(36px, 4.5vw, 64px);
  letter-spacing: 4px;
  text-align: center;
  color: #fff;
  text-shadow: 0 0 18px var(--gold), 0 0 6px #fff;
  line-height: 1.1;
  padding-bottom: 20px;
}
.gm-board { flex: 1; display: grid; grid-template-rows: repeat(5, 1fr); gap: 12px; }
.gm-row {
  display: flex; align-items: center; padding: 0 32px;
  border-radius: 6px; box-shadow: inset 0 0 16px rgba(255,215,0,.2);
}
.gm-row.hidden {
  background: var(--bg-card);
  border: 3px solid var(--gold);
  color: var(--gold);
  justify-content: center;
  font-family: 'Bebas Neue';
  font-size: clamp(40px, 5vw, 72px);
}
.gm-row.revealed {
  background: linear-gradient(180deg, var(--gold), var(--gold-2));
  color: var(--bg-deep);
  font-weight: 800;
  border: 3px solid #c79100;
  justify-content: space-between;
}
.gm-row .ans { text-transform: uppercase; letter-spacing: 2px; font-size: clamp(24px, 2.5vw, 36px); }
.gm-row .pts { font-family: 'Bebas Neue'; font-size: clamp(36px, 4vw, 56px); }
.gm-scores {
  display: flex; gap: 24px; align-items: center;
  margin-top: 24px;
}
.gm-team {
  flex: 1;
  background: linear-gradient(180deg, var(--gold), var(--gold-2));
  color: var(--bg-deep);
  font-family: 'Bebas Neue';
  text-align: center;
  padding: 16px 24px;
  border-radius: 6px;
  box-shadow: 0 0 24px rgba(255,215,0,.4);
  border: 3px solid transparent;
}
.gm-team.active {
  border-color: #fff;
  box-shadow: 0 0 36px rgba(255,215,0,.85);
}
.gm-team.match-winner {
  animation: gm-winner-pulse 1.4s ease-in-out infinite;
}
@keyframes gm-winner-pulse {
  0%,100% { box-shadow: 0 0 36px rgba(255,215,0,.85); }
  50%     { box-shadow: 0 0 56px rgba(255,215,0,1); }
}
.gm-team .name { font-size: clamp(20px, 2vw, 28px); letter-spacing: 4px; }
.gm-team .score { font-size: clamp(56px, 6vw, 88px); line-height: 1; }
.gm-team .winner-tag { display: block; font-size: 12px; letter-spacing: 3px; margin-top: 4px; opacity: .8; }
.gm-strikes { display: flex; gap: 12px; padding: 0 16px; }
.gm-strike {
  width: 56px; height: 56px;
  border: 3px solid var(--red);
  color: var(--red);
  font-family: 'Bebas Neue';
  font-size: 40px;
  display: flex; align-items: center; justify-content: center;
  opacity: 0.18;
}
.gm-strike.lit { opacity: 1; text-shadow: 0 0 8px var(--red); background: rgba(204,0,0,.12); }
```

- [ ] **Step 2: Update `GameModeView.tsx`** to use these class names. Replace inline-style approach with `<div className="gm-stage">` etc. Use the `match-winner` class on the leading team's panel when `currentMatchState === 'awarded'` and `canAdvanceMatch(state)` is true.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/GameModeView.css src/views/projector/GameModeView.tsx
git commit -m "style(projector): full classic-TV styling on GameModeView"
```

---

### Task 5: Strike overlay animation with Framer Motion

**Files:**
- Create: `src/views/projector/StrikeOverlay.tsx`
- Modify: `src/views/projector/GameModeView.tsx`

- [ ] **Step 1: Component**

```typescript
import { motion, AnimatePresence } from 'framer-motion';

export function StrikeOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.92 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 1, 0.4, 1] }}
          style={{
            position: 'fixed', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 999,
          }}
        >
          <motion.div
            initial={{ rotate: -8 }}
            animate={{ rotate: [-8, 4, -3, 0] }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: 'Bebas Neue',
              fontSize: '48vh',
              color: 'var(--red)',
              textShadow: '0 0 60px var(--red), 0 0 120px var(--red)',
            }}
          >X</motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Trigger on strike count change** — in `GameModeView.tsx`, use a `useRef` + `useEffect` to detect when `strikesA + strikesB` increases and show the overlay for 1200ms.

```typescript
const totalStrikes = (q?.strikesA ?? 0) + (q?.strikesB ?? 0);
const prev = useRef(totalStrikes);
const [showStrike, setShowStrike] = useState(false);
useEffect(() => {
  if (totalStrikes > prev.current) {
    setShowStrike(true);
    const t = setTimeout(() => setShowStrike(false), 1200);
    prev.current = totalStrikes;
    return () => clearTimeout(t);
  }
  prev.current = totalStrikes;
}, [totalStrikes]);
```

- [ ] **Step 3: Render `<StrikeOverlay visible={showStrike} />` inside `GameModeView`.**

- [ ] **Step 4: Commit**

```bash
git add src/views/projector/StrikeOverlay.tsx src/views/projector/GameModeView.tsx
git commit -m "feat(projector): animated X strike overlay"
```

---

### Task 6: Reveal animation on answer panels

**Files:**
- Modify: `src/views/projector/GameModeView.tsx`, `GameModeView.css`

- [ ] **Step 1: Wrap each answer row in a Framer Motion component with a flip animation when its `revealed` flag flips true**

```typescript
import { motion } from 'framer-motion';

// ...
{def.answers.map((ans, i) => {
  const revealed = q?.revealedAnswers.includes(i);
  return (
    <motion.div
      key={i}
      className={`gm-row ${revealed ? 'revealed' : 'hidden'}`}
      initial={false}
      animate={{ rotateX: revealed ? 360 : 0 }}
      transition={{ duration: 0.6 }}
    >
      {revealed
        ? <><span className="ans">{ans.text}</span><span className="pts">{ans.points}</span></>
        : <span>{i + 1}</span>}
    </motion.div>
  );
})}
```

- [ ] **Step 2: Verify** in browser — each newly-revealed panel does a card-flip.
- [ ] **Step 3: Commit**

```bash
git add src/views/projector/
git commit -m "feat(projector): card-flip reveal animation on answer panels"
```

---

### Task 7: Win-condition cue on game-mode (winning team's panel pulses + WINNER tag)

**Files:**
- Modify: `src/views/projector/GameModeView.tsx`

- [ ] **Step 1: Add a selector**

In `src/state/selectors.ts`:

```typescript
export function matchOverWinningTeamId(state: TournamentState): string | null {
  const m = getCurrentMatch(state);
  if (!m || state.currentMatchState !== 'awarded') return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
}
```

- [ ] **Step 2: Apply `match-winner` class + WINNER tag** in `GameModeView.tsx` when team's id matches the selector.

```typescript
const winningId = matchOverWinningTeamId(state);
// in the JSX, on the team panel:
<div className={`gm-team ${winningId === m.teamAId ? 'match-winner' : ''} ${activeIsA ? 'active' : ''}`}>
  <div className="name">{a?.name}{winningId === m.teamAId && <span className="winner-tag">WINNER</span>}</div>
  <div className="score">{m.scoreA}</div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/state/selectors.ts src/views/projector/GameModeView.tsx
git commit -m "feat(projector): win-condition pulse + WINNER tag on game-mode"
```

---

## Phase 3: BracketView visual polish (Tasks 8–10)

### Task 8: Bracket layout — V5 styling pass

**Files:**
- Create: `src/views/projector/BracketView.css`
- Modify: `src/views/projector/BracketView.tsx`

- [ ] **Step 1: Copy CSS from the V5 wireframe** (`.brk5-*` classes in `.superpowers/brainstorm/<session>/content/bracket-view-v5.html`). Strip the visual-companion frame styling; keep only the bracket-specific selectors. Rename to `.brk-*`.

- [ ] **Step 2: Restructure `BracketView.tsx`** to mirror the V5 markup: title row → headers row → 3-round tree → corner footnote.

- [ ] **Step 3: Verify in browser** — bracket renders identical to the V5 mockup.

- [ ] **Step 4: Commit**

```bash
git add src/views/projector/BracketView.css src/views/projector/BracketView.tsx
git commit -m "style(projector): bracket V5 styling"
```

---

### Task 9: Bracket connector lines via CSS pseudo-elements

**Files:**
- Modify: `src/views/projector/BracketView.css`

- [ ] **Step 1: Implement** the pure-CSS connectors from V5:

```css
.brk-pair { position: relative; }
.brk-pair::before {
  content: '';
  position: absolute;
  right: -20px; top: 25%; bottom: 25%;
  width: 4px;
  background: var(--gold);
  box-shadow: 0 0 6px rgba(255,215,0,.5);
}
.brk-pair::after {
  content: '';
  position: absolute;
  right: -40px; top: 50%;
  width: 24px; height: 4px;
  background: var(--gold);
  transform: translateY(-50%);
  box-shadow: 0 0 6px rgba(255,215,0,.5);
}
.brk-match::after {
  content: '';
  position: absolute;
  right: -20px; top: 50%;
  width: 20px; height: 4px;
  background: var(--gold);
  transform: translateY(-50%);
}
.brk-round-final .brk-match::after { display: none; }
```

- [ ] **Step 2: Verify** — connectors visible, properly aligned.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/BracketView.css
git commit -m "style(projector): bracket connector lines"
```

---

### Task 10: Bracket — wildcard treatment + WC pill in semis + live pulse

**Files:**
- Modify: `src/views/projector/BracketView.tsx`, `BracketView.css`

- [ ] **Step 1: Wildcard slot** — add a 4th item to the R1 column (paired with M3) using a special `.wildcard` CSS class:

```css
.brk-match.wildcard {
  background: linear-gradient(135deg, #3a0066, #1f003a);
  border-style: dashed;
  border-color: var(--purple);
}
```

- [ ] **Step 2: WC pill** — when rendering Semi 2 in the bracket, prefix the wildcard team's name with a small purple pill:

```typescript
function teamLabel(state, teamId, isWildcard) {
  const name = state.teams.find(t => t.id === teamId)?.name ?? '—';
  return isWildcard
    ? <><span className="wc-pill">★ WC</span> {name}</>
    : name;
}
```

CSS:

```css
.wc-pill {
  display: inline-block;
  background: var(--purple-deep);
  color: white;
  font-family: 'Bebas Neue';
  font-size: 11px;
  letter-spacing: 1px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
}
```

- [ ] **Step 3: Live pulse** — apply `.live` class to the in-progress match card.

```css
.brk-match.live {
  border-color: white;
  animation: brk-pulse 1.6s ease-in-out infinite;
}
@keyframes brk-pulse {
  0%,100% { box-shadow: 0 0 18px var(--gold), 0 0 32px rgba(255,215,0,.45); }
  50%     { box-shadow: 0 0 28px var(--gold), 0 0 48px rgba(255,215,0,.65); }
}
```

- [ ] **Step 4: Corner footnote** — bottom-right wildcard explainer. Bump font size from V5's value to ~12px (V5 was too small).

```css
.brk-footnote {
  position: absolute; bottom: 12px; right: 20px;
  font-family: 'Fjalla One';
  font-size: 12px;
  font-style: italic;
  color: rgba(184,107,255,.85);
  text-align: right;
  line-height: 1.4;
  max-width: 240px;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/views/projector/BracketView.tsx src/views/projector/BracketView.css
git commit -m "style(projector): wildcard slot, WC pill, live pulse, footnote"
```

---

## Phase 4: AdminView visual polish (Tasks 11–12)

### Task 11: Admin chrome polish

**Files:**
- Create: `src/views/admin/AdminView.css`
- Modify: `src/views/admin/AdminView.tsx`, all 6 subview files

- [ ] **Step 1: CSS** — apply the in-match admin layout from `admin-view-v1.html` (top bar with match context + glyph buttons, body 2-column with question board left + controls right, footer with status + undo button).

```css
.adm-stage { display: flex; flex-direction: column; height: 100vh; background: linear-gradient(180deg, var(--bg-mid), var(--bg-deep)); color: var(--gold); }
.adm-topbar { display: flex; align-items: center; padding: 8px 16px; background: rgba(0,0,0,.25); border-bottom: 1px solid rgba(255,215,0,.25); gap: 12px; }
.adm-context { font-family: 'Bebas Neue'; font-size: 14px; letter-spacing: 2px; flex: 1; color: white; }
.adm-glyph { width: 32px; height: 32px; border-radius: 4px; background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.3); display: flex; align-items: center; justify-content: center; color: rgba(255,215,0,.7); cursor: pointer; }
.adm-glyph[aria-pressed="true"] { background: linear-gradient(180deg, var(--gold), var(--gold-2)); color: var(--bg-deep); border-color: white; box-shadow: 0 0 10px rgba(255,215,0,.6); }
.adm-body { flex: 1; padding: 16px; overflow: auto; }
.adm-footer { padding: 8px 16px; background: rgba(0,0,0,.25); border-top: 1px solid rgba(255,215,0,.25); display: flex; align-items: center; gap: 12px; font-family: 'Inter'; font-size: 11px; }
.adm-status { flex: 1; color: var(--text-secondary); }
.adm-status .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--green); margin-right: 6px; box-shadow: 0 0 4px var(--green); }

/* Reusable button styles for admin */
.adm-btn { background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.4); color: var(--gold); padding: 8px 12px; border-radius: 3px; font-family: 'Inter'; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; }
.adm-btn:hover { background: rgba(255,215,0,.2); }
.adm-btn--warn { color: #ff7777; border-color: rgba(255,119,119,.5); }
.adm-btn--ok   { background: var(--green); color: white; border-color: var(--green); }
.adm-btn--ok-pulse { animation: adm-cta 1.6s ease-in-out infinite; }
@keyframes adm-cta {
  0%,100% { box-shadow: 0 0 14px rgba(45,192,107,.5); }
  50%     { box-shadow: 0 0 22px rgba(45,192,107,.85); }
}
```

- [ ] **Step 2: Re-skin all admin subviews** to use these classes. Lift inline styles into the CSS.

- [ ] **Step 3: ViewSwitcher** — replace placeholder glyphs with proper SVG icons (use lucide-react if you want; otherwise hand-rolled SVG):

```typescript
// install: npm install lucide-react
import { Tv, Trophy } from 'lucide-react';

export function ViewSwitcher() {
  const { state, dispatch } = useGameState();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button className="adm-glyph" aria-pressed={state.projectorView === 'game'}
              onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' })}>
        <Tv size={18} />
      </button>
      <button className="adm-glyph" aria-pressed={state.projectorView === 'bracket'}
              onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' })}>
        <Trophy size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/views/admin/ src/components/ViewSwitcher.tsx package.json
git commit -m "style(admin): polished chrome + lucide glyph icons"
```

---

### Task 12: Hotkeys (Cmd+Z undo, G/B view switch, Space=advance)

**Files:**
- Create: `src/hooks/useHotkeys.ts`
- Modify: `src/views/admin/AdminView.tsx`

- [ ] **Step 1: Hook**

```typescript
import { useEffect } from 'react';

type Binding = { combo: string; handler: () => void; description: string };

export function useHotkeys(bindings: Binding[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const combo = [
        e.metaKey || e.ctrlKey ? 'mod' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ].filter(Boolean).join('+');
      const match = bindings.find(b => b.combo === combo);
      if (match) {
        e.preventDefault();
        match.handler();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bindings]);
}
```

- [ ] **Step 2: Wire into AdminView**

```typescript
useHotkeys([
  { combo: 'mod+z', handler: () => dispatch({ type: 'UNDO' }), description: 'Undo last action' },
  { combo: 'g',     handler: () => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' }), description: 'Show game on projector' },
  { combo: 'b',     handler: () => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' }), description: 'Show bracket on projector' },
]);
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHotkeys.ts src/views/admin/AdminView.tsx
git commit -m "feat(admin): hotkeys (Cmd+Z, G, B)"
```

---

## Phase 5: Audio kit (Tasks 13–17)

### Task 13: Source audio assets

**Files:**
- Create: `src/audio/assets/` (multiple files)

- [ ] **Step 1: Source the following CC0 / royalty-free clips** from freesound.org, save with these exact names:

| Filename | Description | Search terms |
|----------|-------------|--------------|
| `reveal-ding.mp3` | bright bell ding for revealing an answer | "ding bell short", CC0 |
| `strike-sting.mp3` | the iconic *EH-EHHH* (game-show error buzzer) | "buzzer wrong", CC0 |
| `match-end.mp3` | upbeat short sting at match win | "victory short sting", CC0 |
| `champion-fanfare.mp3` | longer fanfare for tournament champion | "fanfare trumpet", CC0 |
| `fm-tick.mp3` | clock tick for last 10 seconds of FM | "clock tick", CC0 |
| `fm-time-up.mp3` | buzzer for FM time expiring | "buzzer end short", CC0 |

Each clip should be < 3 seconds (except fanfare ~5s). Total target: under 2 MB combined.

- [ ] **Step 2: Add to Vite static assets** — Vite serves anything in `public/` directly. Place files at `public/audio/<filename>` so they're addressable as `/audio/<filename>` in the SPA.

- [ ] **Step 3: Commit**

```bash
git add public/audio/
git commit -m "chore(audio): source CC0 audio assets"
```

---

### Task 14: AudioContext provider + autoplay unlock

**Files:**
- Create: `src/audio/AudioContext.tsx`, `src/hooks/useSfx.ts`
- Create: `src/views/projector/ProjectorSplash.tsx`

- [ ] **Step 1: Audio context**

```typescript
import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

const SFX = {
  reveal:    '/audio/reveal-ding.mp3',
  strike:    '/audio/strike-sting.mp3',
  matchEnd:  '/audio/match-end.mp3',
  champion:  '/audio/champion-fanfare.mp3',
  fmTick:    '/audio/fm-tick.mp3',
  fmTimeUp:  '/audio/fm-time-up.mp3',
};
type SfxName = keyof typeof SFX;

type AudioCtx = {
  unlocked: boolean;
  unlock: () => void;
  play: (name: SfxName) => void;
};
const Ctx = createContext<AudioCtx | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const cache = useRef<Record<string, HTMLAudioElement>>({});

  const unlock = useCallback(() => {
    Object.entries(SFX).forEach(([k, path]) => {
      const a = new Audio(path);
      a.volume = 0.7;
      cache.current[k] = a;
      // Touch each clip to satisfy autoplay policy
      a.play().then(() => a.pause()).catch(() => {});
    });
    setUnlocked(true);
  }, []);

  const play = useCallback((name: SfxName) => {
    if (!unlocked) return;
    const a = cache.current[name];
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [unlocked]);

  return <Ctx.Provider value={{ unlocked, unlock, play }}>{children}</Ctx.Provider>;
}

export function useSfx() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AudioProvider missing');
  return v;
}
```

- [ ] **Step 2: ProjectorSplash** — initial click-to-start screen on `/projector`:

```typescript
import { useSfx } from '../../audio/AudioContext';

export function ProjectorSplash() {
  const { unlock } = useSfx();
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, var(--bg-mid), var(--bg-deep))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', zIndex: 1,
    }} onClick={unlock}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 96, color: 'var(--gold)', textShadow: '0 0 24px var(--gold)' }}>
          EGPS FAMILY FEUD
        </h1>
        <p style={{ color: 'white', fontSize: 24, marginTop: 32 }}>
          Click anywhere to begin
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire AudioProvider into App.tsx** (wrap below PersistenceProvider). In `ProjectorView.tsx`, render `<ProjectorSplash />` while `!unlocked`.

- [ ] **Step 4: Commit**

```bash
git add src/audio/ src/hooks/useSfx.ts src/views/projector/ProjectorSplash.tsx src/App.tsx
git commit -m "feat(audio): AudioProvider + autoplay-unlock splash"
```

---

### Task 15: Wire reveal + strike sounds

**Files:**
- Modify: `src/views/projector/GameModeView.tsx`

- [ ] **Step 1: Detect reveal** — `useEffect` that watches `q?.revealedAnswers.length`; if it grows, play `reveal`.

```typescript
const { play } = useSfx();
const prevRevealed = useRef<number>(0);
useEffect(() => {
  const n = q?.revealedAnswers.length ?? 0;
  if (n > prevRevealed.current) play('reveal');
  prevRevealed.current = n;
}, [q?.revealedAnswers.length]);
```

- [ ] **Step 2: Strike sound** — fire `play('strike')` when `totalStrikes` grows (existing `useEffect` from Task 5 — add the call there).

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/GameModeView.tsx
git commit -m "feat(audio): reveal + strike sounds in GameModeView"
```

---

### Task 16: Match-end + champion sounds

**Files:**
- Modify: `src/views/projector/GameModeView.tsx`, `BracketView.tsx`

- [ ] **Step 1: Match-end** in GameModeView — when `currentMatchState` flips to `'awarded'` AND `canAdvanceMatch(state)` is true, play `matchEnd`.

- [ ] **Step 2: Champion fanfare** — when `state.bracket.champion` becomes non-null (in either projector view), play `champion`.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/
git commit -m "feat(audio): match-end and champion fanfare hooks"
```

---

### Task 17: Fast Money clock ticks

**Files:**
- Modify: `src/views/admin/FastMoneySubview.tsx`

- [ ] **Step 1: Tick on last 10 seconds; buzzer on time-up.**

```typescript
useEffect(() => {
  if (seconds <= 0) { play('fmTimeUp'); return; }
  if (seconds <= 10) play('fmTick');
}, [seconds]);
```

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/FastMoneySubview.tsx
git commit -m "feat(audio): Fast Money clock + time-up sounds"
```

---

## Phase 6: Fast Money theatrics (Tasks 18–20)

### Task 18: FM big-clock display + animated countdown

**Files:**
- Create: `src/views/projector/FastMoneyView.tsx`
- Modify: `src/views/projector/ProjectorView.tsx`

- [ ] **Step 1: New projector subview** for Fast Money — when `state.bracket.fastMoney !== null`, ProjectorView routes here instead of GameModeView.

```typescript
import { motion } from 'framer-motion';
import type { TournamentState } from '../../state/types';

export function FastMoneyView({ state, secondsRemaining }: { state: TournamentState; secondsRemaining: number }) {
  const fm = state.bracket.fastMoney!;
  const phase = fm.player2.length > 0 ? 'player2' : 'player1';
  const danger = secondsRemaining <= 10;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
      <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 96, color: 'var(--gold)' }}>FAST MONEY</h1>
      <motion.div
        animate={{ scale: danger ? [1, 1.06, 1] : 1, color: danger ? '#ff5555' : '#ffd700' }}
        transition={{ duration: 0.6, repeat: danger ? Infinity : 0 }}
        style={{ fontFamily: 'Bebas Neue', fontSize: 240, lineHeight: 1, textShadow: '0 0 40px currentColor' }}
      >{secondsRemaining}</motion.div>
      <div style={{ fontFamily: 'Bebas Neue', fontSize: 36, letterSpacing: 4, marginTop: 24 }}>
        PLAYER {phase === 'player1' ? '1' : '2'}
      </div>
      <div style={{ marginTop: 16, fontSize: 36, color: 'var(--gold)' }}>
        Total: {fm.player1.reduce((s, a) => s + a.points, 0) + fm.player2.reduce((s, a) => s + a.points, 0)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/projector/FastMoneyView.tsx src/views/projector/ProjectorView.tsx
git commit -m "feat(projector): Fast Money projector view with big clock"
```

---

### Task 19: FM final reveal animation (count-up to total)

**Files:**
- Modify: `src/views/projector/FastMoneyView.tsx`

- [ ] **Step 1: When player 2 finishes, show a "REVEAL" mode** — count up from 0 to the total over ~3s using Framer Motion's `useMotionValue` + `animate`.

```typescript
import { animate, useMotionValue } from 'framer-motion';
import { useEffect, useState } from 'react';

function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(0);
  const v = useMotionValue(0);
  useEffect(() => {
    const controls = animate(v, to, {
      duration: 3,
      ease: 'easeOut',
      onUpdate: latest => setShown(Math.round(latest)),
    });
    return controls.stop;
  }, [to, v]);
  return <span>{shown}</span>;
}
```

Use `<CountUp to={fm.totalScore} />` in the reveal phase.

- [ ] **Step 2: If `fm.won`, play champion fanfare and show "WINNERS" overlay.**

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/FastMoneyView.tsx
git commit -m "feat(projector): FM count-up reveal animation"
```

---

### Task 20: Champion fanfare on bracket view

**Files:**
- Create: `src/views/projector/WinFanfare.tsx`
- Modify: `src/views/projector/BracketView.tsx`

- [ ] **Step 1: Component** — when champion is set, full-screen overlay celebrating the winner with their team name, brief gold-burst Framer Motion animation, and a "CHAMPIONS" caption.

```typescript
import { motion, AnimatePresence } from 'framer-motion';

export function WinFanfare({ teamName }: { teamName: string | null }) {
  return (
    <AnimatePresence>
      {teamName && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'radial-gradient(ellipse at center, var(--gold) 0%, var(--bg-deep) 70%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 998,
          }}
        >
          <motion.div
            initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.1, 1] }} transition={{ duration: 0.8 }}
            style={{ fontFamily: 'Bebas Neue', fontSize: 36, letterSpacing: 8, color: 'var(--bg-deep)' }}
          >CHAMPIONS</motion.div>
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
            style={{ fontFamily: 'Bebas Neue', fontSize: 200, color: 'var(--bg-deep)', textShadow: '0 8px 0 rgba(0,0,0,.2)' }}
          >{teamName}</motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Render in BracketView** — `<WinFanfare teamName={championName} />` when `state.bracket.champion` is set.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/WinFanfare.tsx src/views/projector/BracketView.tsx
git commit -m "feat(projector): champion fanfare overlay"
```

---

## Phase 7: Final cleanup (Tasks 21–22)

### Task 21: Cross-browser smoke test

- [ ] **Step 1:** Test on the actual host laptop in the actual deployment environment (Chrome). Walk through full tournament with audio, refresh test, projector pop-out test.
- [ ] **Step 2:** If any second browser is plausible (Edge, Safari), test there too.
- [ ] **Step 3:** Verify the projector window survives ~30 minutes of play without state drift, console errors, or memory issues.
- [ ] **Step 4:** Document any known issues / browser quirks in `README.md`.

```bash
git add README.md
git commit -m "docs: known issues and browser notes"
```

---

### Task 22: Day-of-event runbook

**Files:**
- Create: `docs/RUNBOOK.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Family Feud Day-of Runbook

## Pre-event setup (do 30 min before doors open)

1. Connect projector via HDMI. In display settings: **Extend (not Mirror)**. Set projector to 1920×1080 if available.
2. Open browser, go to https://<cloudfront-url>/admin
3. Click "Open Projector Window"
4. Drag the new window to the projector display, then F11 (or Cmd-Ctrl-F on Mac) to fullscreen
5. Click anywhere on the projector window to unlock audio
6. Test audio: in admin, reveal an answer (you should hear the ding through the PA)
7. Test view switch: click the bracket glyph in admin top-right; projector switches to bracket. Switch back to game.

## Running a tournament

1. Register 6 teams in admin → Start Tournament
2. For each match: face-off → reveal → strikes → award → advance
3. Use Cmd+Z if you misclick (multi-step undo within match)
4. Confirmation modal will fire on Match Advance

## If something breaks

- **Browser crashes:** reopen `/admin`, click "Resume in-progress tournament"
- **Projector window closes:** click "Open Projector Window" in admin again, drag to projector
- **Audio stops working:** reload projector window, click to re-unlock
- **State seems out of sync:** check the green dot in admin footer — if it's red, you've lost AWS connection. Wait ~10s for retry.

## Hotkeys

- `Cmd/Ctrl + Z` — Undo last action
- `G` — Switch projector to game-mode view
- `B` — Switch projector to bracket view
```

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: day-of-event runbook"
```

---

## Self-review

**Spec coverage:**
- §9 Visual design specifics — Tasks 4–11.
- §8 Audio — Tasks 13–17.
- §4.3 Fast Money admin theatrics — Tasks 18–20.
- §10 #2 (connector polish), #3 (footnote sizing), #4 (hotkeys), #5 (final fanfare) — Tasks 9, 10, 12, 20.
- §12 #3 (extended-display setup) — runbook covers it (Task 22).

**Gaps acknowledged:**
- §5 final-fanfare animation could be more elaborate (confetti physics) — current is gold-burst + caption. Sufficient for the event; physics can come later if there's time.
- §10 #1 (AWS profile/region) — caller's responsibility, documented in deploy script.
- §10 #6 (custom domain) — out of scope per spec.

**Type-consistency check:** New actions `HYDRATE` and `START_FAST_MONEY` are added to the `Action` union in Task 1 + Task 2 and excluded from `StackedAction` in Task 1. New SFX names match the asset filenames table in Task 13.

**Placeholder scan:** All steps have concrete file paths, code blocks, or commands. No TBD/TODO/"add appropriate" entries.
