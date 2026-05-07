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
