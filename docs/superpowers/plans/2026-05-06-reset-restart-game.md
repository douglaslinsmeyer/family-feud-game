# Reset / Restart Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Reset and Restart buttons to the admin footer that wipe tournament state via a two-step confirmation modal. Reset clears teams; Restart preserves team names. Both reuse the existing `tournamentId` so the projector picks up the wipe automatically.

**Architecture:** Two new reducer actions (`RESET_GAME`, `RESTART_GAME`) call a shared `freshState(prev, { keepTeams })` helper that returns an `initialState()`-shaped object with `tournamentId` and `createdAt` preserved. The admin footer renders two new buttons; clicking either opens a reusable `ConfirmDangerModal` that dispatches the relevant action on confirm. No persistence-layer or projector changes required.

**Tech Stack:** React 19, TypeScript, Vitest + jsdom + @testing-library/react + @testing-library/user-event.

**Spec:** `docs/superpowers/specs/2026-05-06-reset-restart-game-design.md`

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/state/types.ts` | Modify | Add `RESET_GAME` and `RESTART_GAME` to `Action` union |
| `src/state/reducer.ts` | Modify | Add `freshState()` helper and two case handlers |
| `tests/state/reducer.reset.test.ts` | Create | Reducer unit tests for both new actions |
| `src/components/ConfirmDangerModal.tsx` | Create | Reusable danger-confirmation modal |
| `src/components/ConfirmDangerModal.css` | Create | Modal styling |
| `tests/components/ConfirmDangerModal.test.tsx` | Create | Modal component tests |
| `src/views/admin/AdminView.tsx` | Modify | Footer buttons + modal-open state + dispatch wiring |
| `src/views/admin/AdminView.css` | Modify | Styles for new footer buttons |
| `src/views/admin/SetupSubview.tsx` | Modify | Seed local input state from `state.teams` so RESTART pre-fills inputs (currently always starts empty — discovered during plan-writing) |
| `tests/views/AdminView.reset.test.tsx` | Create | Integration test for footer buttons → modal → dispatch |

---

## Task 1: Reducer action types

**Files:**
- Modify: `src/state/types.ts`

- [ ] **Step 1: Add the two new action variants to the `Action` union.**

In `src/state/types.ts`, locate the `Action` union (currently ending at line ~96 with `| { type: 'HYDRATE'; state: TournamentState }`). Insert the two new variants immediately before the `'UNDO'` line so the destructive actions live with the other top-level lifecycle actions. The `Action` union will look like (showing only the change region):

```ts
  | { type: 'SET_PROJECTOR_VIEW'; view: ProjectorView }
  | { type: 'RESET_GAME' }
  | { type: 'RESTART_GAME' }
  | { type: 'UNDO' }
  | { type: 'HYDRATE'; state: TournamentState };
```

Note: do NOT add these to `StackedAction` — they should not be undoable.

- [ ] **Step 2: Run typecheck to confirm the addition compiles.**

Run: `npx tsc -b --noEmit`
Expected: PASS (a new pair of unhandled cases will surface as a reducer warning in the next task — that's fine since the reducer's `default` returns `state`, but we'll add the cases properly in Task 2).

- [ ] **Step 3: Commit.**

```bash
git add src/state/types.ts
git commit -m "feat(state): declare RESET_GAME and RESTART_GAME action types"
```

---

## Task 2: Reducer logic + tests (TDD)

**Files:**
- Modify: `src/state/reducer.ts`
- Create: `tests/state/reducer.reset.test.ts`

- [ ] **Step 1: Write the failing reducer tests.**

Create `tests/state/reducer.reset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import type { Team, TournamentState } from '../../src/state/types';

const T = (id: string, name: string): Team => ({ id, name, members: [] });
const sixTeams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));

function midTournament(): TournamentState {
  const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(withTeams, { type: 'START_TOURNAMENT' });
}

describe('reducer: RESET_GAME', () => {
  it('clears teams and bracket but preserves tournamentId and createdAt', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESET_GAME' });

    expect(after.tournamentId).toBe(before.tournamentId);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.teams).toEqual([]);
    expect(after.status).toBe('setup');
    expect(after.bracket.round1).toEqual([]);
    expect(after.bracket.semis).toEqual([]);
    expect(after.bracket.final).toBeNull();
    expect(after.bracket.fastMoney).toBeNull();
    expect(after.bracket.champion).toBeNull();
    expect(after.currentMatchPath).toBeNull();
    expect(after.currentMatchState).toBe('face_off');
    expect(after.actionStack).toEqual([]);
    expect(after.matchStartSnapshot).toBeNull();
    expect(after.projectorView).toBe('game');
  });

  it('updates updatedAt to now', () => {
    const before = midTournament();
    const earlier = before.updatedAt;
    const after = reducer({ ...before, updatedAt: earlier - 1000 }, { type: 'RESET_GAME' });
    expect(after.updatedAt).toBeGreaterThanOrEqual(earlier - 1000);
  });

  it('restores a full question pool', () => {
    const before = midTournament();
    expect(before.questionPool.used.length).toBeGreaterThan(0);
    const after = reducer(before, { type: 'RESET_GAME' });
    expect(after.questionPool.used).toEqual([]);
    expect(after.questionPool.available.length).toBe(initialState().questionPool.available.length);
    expect(after.fastMoneyPool.used).toEqual([]);
  });

  it('is idempotent on an already-empty state', () => {
    const empty = initialState();
    const after = reducer(empty, { type: 'RESET_GAME' });
    expect(after.teams).toEqual([]);
    expect(after.status).toBe('setup');
    expect(after.tournamentId).toBe(empty.tournamentId);
  });
});

describe('reducer: RESTART_GAME', () => {
  it('preserves teams verbatim while clearing bracket', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.teams).toEqual(sixTeams);
    expect(after.status).toBe('setup');
    expect(after.bracket.round1).toEqual([]);
    expect(after.bracket.semis).toEqual([]);
    expect(after.bracket.final).toBeNull();
    expect(after.currentMatchPath).toBeNull();
    expect(after.actionStack).toEqual([]);
  });

  it('preserves tournamentId and createdAt', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.tournamentId).toBe(before.tournamentId);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('restores a full question pool', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.questionPool.used).toEqual([]);
    expect(after.fastMoneyPool.used).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `npx vitest run tests/state/reducer.reset.test.ts`
Expected: FAIL — RESET_GAME and RESTART_GAME hit the reducer's `default` branch, so state is unchanged and assertions fail (e.g., `after.teams` is still 6 teams, not `[]`).

- [ ] **Step 3: Implement `freshState` and the two case handlers in the reducer.**

In `src/state/reducer.ts`, add this helper near the top (above `export function reducer`):

```ts
function freshState(prev: TournamentState, opts: { keepTeams: boolean }): TournamentState {
  const fresh = initialState();
  return {
    ...fresh,
    tournamentId: prev.tournamentId,
    createdAt: prev.createdAt,
    teams: opts.keepTeams ? prev.teams : [],
    updatedAt: Date.now(),
  };
}
```

Add this import at the top of the file (alongside the existing `QUESTIONS` import):

```ts
import { initialState } from './initialState';
```

Then add the two case handlers inside the `switch (action.type)` block. Place them just above `case 'UNDO':` to mirror the type-union ordering:

```ts
    case 'RESET_GAME':
      return freshState(state, { keepTeams: false });

    case 'RESTART_GAME':
      return freshState(state, { keepTeams: true });
```

- [ ] **Step 4: Run tests to confirm they pass.**

Run: `npx vitest run tests/state/reducer.reset.test.ts`
Expected: PASS — all tests in both `describe` blocks green.

- [ ] **Step 5: Run the full test suite to confirm no regressions.**

Run: `npm run test:run`
Expected: PASS for all existing tests (state, persistence, sanity).

- [ ] **Step 6: Commit.**

```bash
git add src/state/reducer.ts tests/state/reducer.reset.test.ts
git commit -m "feat(state): RESET_GAME and RESTART_GAME reducer handlers"
```

---

## Task 3: ConfirmDangerModal component (TDD)

**Files:**
- Create: `src/components/ConfirmDangerModal.tsx`
- Create: `src/components/ConfirmDangerModal.css`
- Create: `tests/components/ConfirmDangerModal.test.tsx`

- [ ] **Step 1: Write the failing component tests.**

Create `tests/components/ConfirmDangerModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDangerModal } from '../../src/components/ConfirmDangerModal';

const baseProps = {
  open: true,
  title: 'Reset tournament?',
  body: 'Everything will be cleared.',
  confirmLabel: 'Reset tournament',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDangerModal', () => {
  it('renders nothing when open is false', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDangerModal {...baseProps} open={false} onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.queryByText('Reset tournament?')).not.toBeInTheDocument();
  });

  it('renders title, body, and confirm label when open', () => {
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Reset tournament?')).toBeInTheDocument();
    expect(screen.getByText('Everything will be cleared.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset tournament' })).toBeInTheDocument();
  });

  it('clicking Cancel calls onCancel and not onConfirm', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking Confirm calls onConfirm and not onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset tournament' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Esc key calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Enter key does NOT call onConfirm (deliberate guard)', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clicking the backdrop calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('confirm-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Cancel is the default-focused button when opened', () => {
    render(<ConfirmDangerModal {...baseProps} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `npx vitest run tests/components/ConfirmDangerModal.test.tsx`
Expected: FAIL — module `'../../src/components/ConfirmDangerModal'` not found.

- [ ] **Step 3: Implement `ConfirmDangerModal`.**

Create `src/components/ConfirmDangerModal.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import './ConfirmDangerModal.css';

export type ConfirmDangerModalProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDangerModal({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDangerModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-modal-backdrop"
      data-testid="confirm-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="confirm-modal-title">{title}</h2>
        <div className="confirm-modal-body">{body}</div>
        <div className="confirm-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-modal-btn confirm-modal-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/ConfirmDangerModal.css`:

```css
.confirm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  font-family: 'Inter', sans-serif;
}

.confirm-modal {
  background: linear-gradient(180deg, #0a1d4f 0%, #061236 100%);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 215, 0, 0.15);
  padding: 24px 28px;
  max-width: 460px;
  width: 90%;
  color: #fff;
}

.confirm-modal-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22px;
  letter-spacing: 2.5px;
  color: var(--gold);
  text-shadow: 0 0 6px var(--gold);
  margin: 0 0 14px 0;
}

.confirm-modal-body {
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 22px;
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-modal-btn {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.confirm-modal-cancel {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.confirm-modal-cancel:hover {
  background: rgba(255, 255, 255, 0.16);
}

.confirm-modal-confirm {
  background: #6b1a1a;
  border-color: #9e2d2d;
  color: #fff;
}

.confirm-modal-confirm:hover {
  background: #8a2424;
  box-shadow: 0 0 12px rgba(204, 0, 0, 0.4);
}

.confirm-modal-cancel:focus-visible,
.confirm-modal-confirm:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run tests to confirm they pass.**

Run: `npx vitest run tests/components/ConfirmDangerModal.test.tsx`
Expected: PASS — all 8 modal tests green.

- [ ] **Step 5: Commit.**

```bash
git add src/components/ConfirmDangerModal.tsx src/components/ConfirmDangerModal.css tests/components/ConfirmDangerModal.test.tsx
git commit -m "feat(components): ConfirmDangerModal with cancel-default focus and Esc-to-cancel"
```

---

## Task 4: Wire footer buttons into AdminView (TDD)

**Files:**
- Create: `tests/views/AdminView.reset.test.tsx`
- Modify: `src/views/admin/AdminView.tsx`
- Modify: `src/views/admin/AdminView.css`
- Modify: `src/views/admin/SetupSubview.tsx`

**Why SetupSubview must be modified:** `SetupSubview` currently initializes its local input state to 6 empty rows and never reads `state.teams`. Without changing that, `RESTART_GAME` would correctly preserve `state.teams` in the reducer but the user would still see blank inputs when the setup screen renders — a visible regression. We seed local state from `state.teams` when it's non-empty.

- [ ] **Step 1: Write the failing integration test.**

Create `tests/views/AdminView.reset.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminView } from '../../src/views/admin/AdminView';
import { GameStateProvider } from '../../src/state/GameStateContext';
import { PersistenceCtx } from '../../src/persistence/PersistenceCtx';
import { MemoryAdapter } from '../../src/persistence/memoryAdapter';
import { initialState } from '../../src/state/initialState';
import { reducer } from '../../src/state/reducer';
import type { Team, TournamentState } from '../../src/state/types';

const T = (id: string, name: string): Team => ({ id, name, members: [] });
const sixTeams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));

function midTournamentState(): TournamentState {
  const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(withTeams, { type: 'START_TOURNAMENT' });
}

async function renderWithSeed(seed: TournamentState) {
  const adapter = new MemoryAdapter();
  await adapter.save(seed);
  localStorage.setItem('family-feud:tournamentId', seed.tournamentId);
  const utils = render(
    <PersistenceCtx.Provider value={adapter}>
      <GameStateProvider isWriter={true}>
        <AdminView />
      </GameStateProvider>
    </PersistenceCtx.Provider>
  );
  // Wait for hydrate effect to complete.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
  });
  return { ...utils, adapter };
}

describe('AdminView: Reset and Restart footer buttons', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows Reset and Restart buttons in the footer mid-tournament', async () => {
    await renderWithSeed(midTournamentState());
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^restart$/i })).toBeInTheDocument();
  });

  it('hides Restart when there are no teams', async () => {
    await renderWithSeed(initialState());
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restart$/i })).not.toBeInTheDocument();
  });

  it('clicking Reset opens the reset confirmation modal', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByText(/reset tournament\?/i)).toBeInTheDocument();
    expect(screen.getByText(/everything will be cleared/i)).toBeInTheDocument();
  });

  it('clicking Restart opens the restart confirmation modal', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    expect(screen.getByText(/restart tournament\?/i)).toBeInTheDocument();
    expect(screen.getByText(/team names will be kept/i)).toBeInTheDocument();
  });

  it('Cancel in the modal leaves state unchanged (still mid-tournament)', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/reset tournament\?/i)).not.toBeInTheDocument();
    // Footer status text "State saved · ... used · ... remaining" only appears when status !== 'setup'.
    expect(screen.getByText(/state saved/i)).toBeInTheDocument();
  });

  it('Confirming Reset clears teams and returns to setup', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset tournament' }));
    // Footer status text "Setup mode — enter team names to begin" only appears when status === 'setup'.
    await waitFor(() => {
      expect(screen.getByText(/setup mode/i)).toBeInTheDocument();
    });
    // Restart should now be hidden since teams.length === 0.
    expect(screen.queryByRole('button', { name: /^restart$/i })).not.toBeInTheDocument();
  });

  it('Confirming Restart preserves team names and returns to setup with pre-filled inputs', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Restart tournament' }));
    // We're now on the setup screen — confirm via footer status.
    await waitFor(() => {
      expect(screen.getByText(/setup mode/i)).toBeInTheDocument();
    });
    // SetupSubview's team-name inputs should be pre-populated with state.teams names.
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const teamNameValues = inputs.map(i => i.value).filter(v => v.length === 1);
    expect(teamNameValues).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E', 'F']));
  });
});
```

Note on selectors: `name: /^reset$/i` uses anchors so it doesn't accidentally match a future "Reset tournament" confirm button (which contains the word "Reset" but is a different control once the modal is open). Same for Restart.

- [ ] **Step 2: Run the integration test to confirm it fails.**

Run: `npx vitest run tests/views/AdminView.reset.test.tsx`
Expected: FAIL — buttons "Reset" and "Restart" not found in the rendered footer.

- [ ] **Step 3: Add the buttons, modal state, and dispatch wiring to `AdminView.tsx`.**

Replace the body of `src/views/admin/AdminView.tsx` with the following. The two changes vs. the current file are: (a) adding `useState` for which modal is open, (b) adding two footer buttons + the `ConfirmDangerModal` render at the end.

```tsx
import { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { getCurrentMatch } from '../../state/bracketLogic';
import { SetupSubview } from './SetupSubview';
import { InMatchSubview } from './InMatchSubview';
import { FaceOffSubview } from './FaceOffSubview';
import { StealSubview } from './StealSubview';
import { BetweenMatchesSubview } from './BetweenMatchesSubview';
import { FastMoneySubview } from './FastMoneySubview';
import { ViewSwitcher } from '../../components/ViewSwitcher';
import { ConfirmDangerModal } from '../../components/ConfirmDangerModal';
import { useHotkeys } from '../../hooks/useHotkeys';
import './AdminView.css';

type DangerModal = 'reset' | 'restart' | null;

export function AdminView() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const [danger, setDanger] = useState<DangerModal>(null);

  useHotkeys([
    { combo: 'mod+z', handler: () => dispatch({ type: 'UNDO' }), description: 'Undo last action' },
    { combo: 'g', handler: () => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' }), description: 'Show game on projector' },
    { combo: 'b', handler: () => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' }), description: 'Show bracket on projector' },
  ]);

  let body;
  if (state.status === 'setup') body = <SetupSubview />;
  else if (state.currentMatchPath?.round === 'final' && state.currentMatchState === 'match_over') body = <FastMoneySubview />;
  else if (state.currentMatchState === 'face_off') body = <FaceOffSubview />;
  else if (state.currentMatchState === 'steal') body = <StealSubview />;
  else if (state.currentMatchState === 'awarded') body = <BetweenMatchesSubview />;
  else body = <InMatchSubview />;

  const roundLabel = (() => {
    if (!state.currentMatchPath) return '';
    const p = state.currentMatchPath;
    if (p.round === 'round1') return `ROUND 1 · MATCH ${p.index + 1}`;
    if (p.round === 'semis') return `SEMI ${p.index + 1}`;
    if (p.round === 'final') return 'FINAL';
    return '';
  })();

  const teamA = match ? state.teams.find(t => t.id === match.teamAId) : null;
  const teamB = match?.teamBId ? state.teams.find(t => t.id === match.teamBId) : null;

  const showRestart = state.teams.length > 0;

  return (
    <div className="adm-stage">
      <header className="adm-topbar">
        <div className="adm-context">
          {roundLabel && <span className="round">{roundLabel} · </span>}
          {teamA?.name ?? 'EGPS Family Feud'}
          {teamB && <><span className="vs">vs</span>{teamB.name}</>}
          {!teamA && !roundLabel && ' — Admin'}
        </div>
        <ViewSwitcher />
      </header>
      <main className="adm-body">{body}</main>
      <footer className="adm-footer">
        <div className="adm-status">
          <span className="dot" />
          {state.status === 'setup'
            ? 'Setup mode — enter team names to begin'
            : `State saved · ${state.questionPool.used.length} used · ${state.questionPool.available.length} remaining (+${state.fastMoneyPool.available.length} Fast Money)`}
        </div>
        <button
          className="adm-undo"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={state.actionStack.length === 0}
          title="Undo (Cmd+Z)"
        >
          ↶ Undo <span className="key">⌘Z</span>
        </button>
        {showRestart && (
          <button
            type="button"
            className="adm-danger-btn"
            onClick={() => setDanger('restart')}
          >
            Restart
          </button>
        )}
        <button
          type="button"
          className="adm-danger-btn"
          onClick={() => setDanger('reset')}
        >
          Reset
        </button>
      </footer>

      <ConfirmDangerModal
        open={danger === 'reset'}
        title="Reset tournament?"
        body="Everything will be cleared: teams, scores, bracket, and question history. This cannot be undone."
        confirmLabel="Reset tournament"
        onCancel={() => setDanger(null)}
        onConfirm={() => {
          dispatch({ type: 'RESET_GAME' });
          setDanger(null);
        }}
      />
      <ConfirmDangerModal
        open={danger === 'restart'}
        title="Restart tournament?"
        body="Scores, bracket, and question history will be cleared. Team names will be kept. This cannot be undone."
        confirmLabel="Restart tournament"
        onCancel={() => setDanger(null)}
        onConfirm={() => {
          dispatch({ type: 'RESTART_GAME' });
          setDanger(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add CSS for the new footer buttons.**

Append to `src/views/admin/AdminView.css` (after the `.adm-undo .key { ... }` block, around line 432):

```css
.adm-danger-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.adm-danger-btn:hover {
  background: rgba(255, 119, 119, 0.12);
  border-color: rgba(255, 119, 119, 0.5);
  color: #ff9999;
}
```

- [ ] **Step 5: Modify `SetupSubview` to seed local state from `state.teams`.**

Edit `src/views/admin/SetupSubview.tsx`. Two changes:

1. Pull `state` (in addition to `dispatch`) from `useGameState()`.
2. Seed the `useState` initializer from `state.teams` when present (i.e., after a `RESTART_GAME`).

Replace the imports + opening of `SetupSubview` (lines 1–15) with:

```tsx
import { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import type { Team } from '../../state/types';

const EMPTY_TEAM = (i: number): Team => ({
  id: `team-${i + 1}`,
  name: '',
  members: ['', '', '', '', ''],
});

function seedTeams(saved: Team[]): Team[] {
  if (saved.length !== 6) {
    return Array.from({ length: 6 }, (_, i) => EMPTY_TEAM(i));
  }
  // Backfill members to length 5 so the existing 5-input UI keeps working
  // even if a saved team had fewer members recorded.
  return saved.map(t => {
    const padded = [...t.members];
    while (padded.length < 5) padded.push('');
    return { ...t, members: padded.slice(0, 5) };
  });
}

export function SetupSubview() {
  const { state, dispatch } = useGameState();
  const [teams, setTeams] = useState<Team[]>(() => seedTeams(state.teams));
```

Leave the rest of the file unchanged. (The `useState` initializer runs once on mount; if the user clicks Restart, `SetupSubview` is unmounted and remounted because `AdminView`'s body switches subviews based on `state.status`. So the initializer will re-run with the preserved `state.teams` after Restart.)

- [ ] **Step 6: Run the integration test to confirm it passes.**

Run: `npx vitest run tests/views/AdminView.reset.test.tsx`
Expected: PASS — all 7 integration tests green, including the Restart-preserves-inputs assertion that was previously failing because of the unfixed `SetupSubview`.

- [ ] **Step 7: Run the full test suite to confirm no regressions.**

Run: `npm run test:run`
Expected: PASS for all tests.

- [ ] **Step 8: Run typecheck and lint.**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: PASS for both.

- [ ] **Step 9: Commit.**

```bash
git add src/views/admin/AdminView.tsx src/views/admin/AdminView.css src/views/admin/SetupSubview.tsx tests/views/AdminView.reset.test.tsx
git commit -m "feat(admin): Reset and Restart footer buttons with confirm modal"
```

---

## Task 5: Manual smoke test in the browser

**Files:** none modified.

This task is the project's standard "test the UI in a browser before declaring done" step from CLAUDE.md.

- [ ] **Step 1: Start the dev server.**

Run: `npm run dev`
Expected: Vite logs a local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Walk the Reset golden path.**

1. Open `/admin` in Chrome.
2. Add 6 team names on the setup screen and click Start Tournament.
3. Play a few face-off / board-play actions to dirty the state.
4. Open `/projector` in a second window. Confirm it shows the live game state.
5. In the admin window, click **Reset** in the footer.
6. Modal appears with title "Reset tournament?" and body listing what will be cleared.
7. Click **Cancel** — modal closes, game state unchanged.
8. Click **Reset** again, then **Reset tournament** in the modal.
9. Admin window returns to the empty setup screen with no team names.
10. Within ~1 second, the projector window updates to its empty/setup state (no manual reload required).

- [ ] **Step 3: Walk the Restart golden path.**

1. Add 6 teams again and start a tournament.
2. Click **Restart** in the footer.
3. Modal title is "Restart tournament?" and body says team names will be kept.
4. Click **Restart tournament** in the modal.
5. Admin returns to setup screen with all 6 team-name inputs **pre-populated** with the prior names.
6. Projector window updates within ~1 second.

- [ ] **Step 4: Verify edge case — Restart hidden when no teams.**

1. Click **Reset** to clear teams.
2. Confirm. Setup screen shows empty inputs.
3. Confirm visually that **only the Reset button** appears in the footer; **Restart** is hidden.

- [ ] **Step 5: Verify Esc and backdrop dismissal.**

1. Add some teams, start a tournament.
2. Click **Reset** → modal opens.
3. Press **Esc** — modal closes, state unchanged.
4. Click **Reset** again, then click outside the modal box (on the dark backdrop).
5. Modal closes, state unchanged.

- [ ] **Step 6: Stop the dev server.**

`Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 7: No commit (this task touches no files).**

---

## Self-review checklist (run before declaring the plan complete)

- All spec requirements have a corresponding task — confirmed:
  - Two new reducer actions → Task 2.
  - `freshState(prev, { keepTeams })` helper → Task 2.
  - `tournamentId` and `createdAt` preserved → Task 2 (test + impl).
  - Action-stack cleared → Task 2 (covered by `actionStack: []` in `initialState()`).
  - Admin footer buttons → Task 4.
  - Restart hidden when no teams → Task 4 (test + impl).
  - `ConfirmDangerModal` with Cancel default focus, Esc-to-cancel, Enter-doesn't-confirm, backdrop-cancels → Task 3.
  - Per-action modal copy → Task 4.
  - Projector picks up wipe via existing polling → Task 5 manual verification (no code change).
  - SetupSubview pre-fills inputs after Restart → Task 4 step 5 (additional implementation detail surfaced during plan-writing; not in the spec but required for the spec's user-visible Restart behavior to actually work).
- No placeholders, all code blocks are complete.
- Type names consistent: `RESET_GAME`, `RESTART_GAME`, `freshState`, `ConfirmDangerModal`, `DangerModal`, `adm-danger-btn`, `seedTeams`.
- Commit messages follow existing style (`feat(scope): ...`).
