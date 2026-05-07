# Reset / Restart Game — Design

**Date:** 2026-05-06
**Status:** Approved (pending implementation plan)

## Purpose

Add two destructive admin-only actions for clearing tournament state during testing or between event runs:

- **Reset** — wipe everything (teams, scores, bracket, question history). Lands at empty setup screen.
- **Restart** — wipe everything *except* team names. Lands at setup screen with team names pre-populated.

Both are intended for the day-of host operator, primarily to recover from misconfiguration during pre-event testing or to start a fresh tournament with the same teams.

## Goals & non-goals

**Goals**
- One-click recovery from a corrupted/stuck tournament.
- Safe enough that a misclick during a live event does not destroy the game.
- Propagates automatically to the projector window without manual intervention.

**Non-goals**
- No partial reset (e.g., "reset just this match"). The existing per-match Undo covers in-match recovery.
- No audit trail of prior tournaments. The DDB row is overwritten in place.
- No keyboard shortcuts for either action — too risky given proximity to Undo (Cmd+Z).

## Architecture

### State / reducer

Two new actions added to `src/state/types.ts`:

```ts
| { type: 'RESET_GAME' }
| { type: 'RESTART_GAME' }
```

Both are handled in `src/state/reducer.ts` and produce a fresh state shaped like `initialState()` with two preserved fields:

- `tournamentId` — kept so the same DDB row (and same localStorage pointer) is overwritten in place. The projector polls this key every 750ms (via `useTournamentPolling`), so it picks up the wipe automatically on the next tick.
- `createdAt` — kept so the tournament's "birth time" remains a stable identifier for the row.

All other fields are reset:

| Field | RESET_GAME | RESTART_GAME |
|---|---|---|
| `teams` | `[]` | `state.teams` (preserved) |
| `status` | `'setup'` | `'setup'` |
| `bracket` | empty (per `initialState`) | empty |
| `currentMatchPath` | `null` | `null` |
| `currentMatchState` | `'face_off'` | `'face_off'` |
| `questionPool` | fresh (full available pool) | fresh |
| `fastMoneyPool` | fresh | fresh |
| `projectorView` | `'game'` | `'game'` |
| `actionStack` | `[]` | `[]` |
| `matchStartSnapshot` | `null` | `null` |
| `updatedAt` | `Date.now()` | `Date.now()` |

Both action handlers delegate to a private helper:

```ts
function freshState(prev: TournamentState, opts: { keepTeams: boolean }): TournamentState
```

This avoids duplication and makes the only difference between the two actions explicit.

Neither action is added to `StackedAction` — they are not undoable. (The action stack is cleared as part of the wipe, and Undo only operates within a match anyway.)

### Persistence

No persistence-layer changes required. The writer's existing `useEffect` in `GameStateProvider` (`src/state/GameStateContext.tsx`) saves on every state change — when the wiped state is dispatched, it is automatically written to DDB / localStorage under the same `tournamentId` key.

The projector's `useTournamentPolling` hook (`src/hooks/useDDBPolling.ts`) polls the same key every 750ms and re-renders with the wiped state on the next tick. No projector-side code changes required.

`localStorage['family-feud:tournamentId']` is unchanged (still points at the same UUID).

## UI

### Admin footer

`AdminView` (`src/views/admin/AdminView.tsx`) footer gains two buttons positioned to the right of Undo:

```
[status text]   [ ↶ Undo ⌘Z ]   [ Restart ]   [ Reset ]
```

Visual treatment:
- Smaller and more muted than primary controls — secondary/subtle styling.
- Not red on resting state (avoids screaming "danger" and being mistaken for a primary action). The destructive intent is communicated in the modal, not the footer.
- `Restart` button is hidden when `state.teams.length === 0` — it would behave identically to Reset in that case, so showing both is noise. (Hidden rather than disabled, since a disabled destructive button invites curiosity without explaining why.)

### ConfirmDangerModal

A new reusable component at `src/components/ConfirmDangerModal.tsx`:

```ts
type Props = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;       // e.g. "Reset tournament" / "Restart tournament"
  onConfirm: () => void;
  onCancel: () => void;
};
```

Behavior:
- Modal overlay with backdrop click → cancel.
- Two buttons: **Cancel** (default-focused, secondary) and **Confirm** (destructive — red).
- `Esc` → cancel.
- `Enter` does **not** confirm (deliberate — confirmation must be an explicit click, to prevent stray Enter presses from committing).
- Focus is trapped within the modal while open; restored to the trigger button on close.

Per-action copy:

| | Reset | Restart |
|---|---|---|
| Title | "Reset tournament?" | "Restart tournament?" |
| Body | "Everything will be cleared: teams, scores, bracket, and question history. This cannot be undone." | "Scores, bracket, and question history will be cleared. Team names will be kept. This cannot be undone." |
| Confirm label | "Reset tournament" | "Restart tournament" |

### Wiring

`AdminView` holds local state for which (if any) modal is open: `'reset' \| 'restart' \| null`. Each footer button sets the local state; the modal calls `dispatch({ type: 'RESET_GAME' })` or `dispatch({ type: 'RESTART_GAME' })` on confirm and clears local state on either confirm or cancel.

## Edge cases

- **Setup mode with no teams** — Restart is hidden. Reset still works; the wipe is a near no-op since state is already empty, but `updatedAt` advances and any partially-filled question pool state is reset to a clean baseline.
- **Mid-Fast Money / match_over** — both actions wipe the bracket entirely; no special handling needed.
- **Mid-action-stack** — action stack is cleared by the wipe; Undo button correctly becomes disabled via its existing `disabled={state.actionStack.length === 0}` check.
- **Modal open when state changes externally** — not possible, since admin is the sole writer.

## Testing

Following the project's BDD + real-classes-where-possible guidance.

### Reducer unit tests (`tests/state/reducer.reset.test.ts`)

- Given a mid-tournament state, when `RESET_GAME` is dispatched, then `teams` is empty, `status` is `'setup'`, `bracket` is empty, `actionStack` is empty, `tournamentId` is preserved, `createdAt` is preserved, `updatedAt` is updated.
- Given a mid-tournament state, when `RESTART_GAME` is dispatched, then `teams` is preserved verbatim, all other fields match the reset shape.
- Given a state in setup with no teams, when either action is dispatched, then state is well-formed (no crashes, idempotent).
- Given a state with `fastMoney` populated, when either action is dispatched, then `bracket.fastMoney` is `null`.

### Component tests (`tests/components/ConfirmDangerModal.test.tsx`)

- Renders title, body, and confirm label from props.
- Cancel button calls `onCancel`, not `onConfirm`.
- Confirm button calls `onConfirm`, not `onCancel`.
- Esc calls `onCancel`.
- Enter does not call `onConfirm`.
- Backdrop click calls `onCancel`.

### Integration test (`tests/views/AdminView.reset.test.tsx`)

Using the real `GameStateProvider` with `MemoryAdapter` (no mocks where avoidable):

- Click Reset → modal opens with reset copy.
- Click Restart → modal opens with restart copy.
- Confirm Reset on a mid-tournament state → teams are empty, `status === 'setup'`.
- Confirm Restart on a mid-tournament state → teams preserved, `status === 'setup'`.
- Cancel → modal closes, state unchanged.
- Restart button hidden when no teams.

## Files touched

**New:**
- `src/components/ConfirmDangerModal.tsx`
- `src/components/ConfirmDangerModal.css`
- `tests/state/reducer.reset.test.ts`
- `tests/components/ConfirmDangerModal.test.tsx`
- `tests/views/AdminView.reset.test.tsx`

**Modified:**
- `src/state/types.ts` — add two `Action` variants.
- `src/state/reducer.ts` — add `freshState()` helper and two case handlers.
- `src/views/admin/AdminView.tsx` — add footer buttons, modal state, modal rendering.
- `src/views/admin/AdminView.css` — styles for the new footer buttons.

## Out of scope (follow-ups, not blockers)

- A `delete()` method on `PersistenceAdapter` for cleaning up DDB rows (not needed since we reuse the row).
- Per-tournament UUIDs / audit trail of prior tournaments (deliberately deferred — see goals).
- Mobile/touch ergonomics for the modal (admin is operated on a laptop; touch is not a target).
