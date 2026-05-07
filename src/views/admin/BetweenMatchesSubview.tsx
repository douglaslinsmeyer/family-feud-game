import { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { canAdvanceMatch, teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';
import { ConfirmModal } from '../../components/ConfirmModal';

export function BetweenMatchesSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const canAdvance = canAdvanceMatch(state);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!match) {
    return <div>No active match</div>;
  }

  const teamA = teamById(state, match.teamAId);
  const teamB = match.teamBId ? teamById(state, match.teamBId) : null;
  const aLeading = match.scoreA > match.scoreB;
  const bLeading = match.scoreB > match.scoreA;

  return (
    <div className="adm-between">
      <ConfirmModal
        open={confirmOpen}
        title="Advance to Next Match"
        message="Advance to the next match? This will finalize the current match result."
        confirmLabel="Advance"
        onConfirm={() => { setConfirmOpen(false); dispatch({ type: 'ADVANCE_MATCH' }); }}
        onCancel={() => setConfirmOpen(false)}
      />

      <h2>Question Complete</h2>

      <div className="adm-score-display">
        <div className={`adm-score-team ${bLeading ? 'dim' : ''}`}>
          <div className="team-name">{teamA?.name ?? match.teamAId}</div>
          <div className="team-score">{match.scoreA}</div>
        </div>
        <div className="adm-between-vs">VS</div>
        <div className={`adm-score-team ${aLeading ? 'dim' : ''}`}>
          <div className="team-name">{teamB?.name ?? (match.teamBId ?? 'TBD')}</div>
          <div className="team-score">{match.scoreB}</div>
        </div>
      </div>

      <div className="adm-between-actions">
        <button
          className="adm-btn"
          style={{ padding: '10px 20px', fontSize: 13 }}
          onClick={() => dispatch({ type: 'RESOLVE_FACE_OFF', teamId: match.teamAId })}
        >
          Play Another Question
        </button>
        <button
          className="adm-next"
          style={{ display: 'inline-block', maxWidth: 280 }}
          onClick={() => setConfirmOpen(true)}
          disabled={!canAdvance}
        >
          → Advance to Next Match
          {!canAdvance && match.scoreA === match.scoreB && (
            <span className="sub">tied — play another question</span>
          )}
        </button>
      </div>
    </div>
  );
}
