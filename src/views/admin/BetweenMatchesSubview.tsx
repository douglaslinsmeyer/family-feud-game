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

  // Determine who won the last question (highest score)
  const aWinning = match.scoreA >= match.scoreB;

  function playAnotherQuestion() {
    dispatch({ type: 'RESOLVE_FACE_OFF', teamId: match!.teamAId });
  }

  function advanceToNextMatch() {
    setConfirmOpen(true);
  }

  function handleConfirmAdvance() {
    setConfirmOpen(false);
    dispatch({ type: 'ADVANCE_MATCH' });
  }

  function handleCancelAdvance() {
    setConfirmOpen(false);
  }

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <ConfirmModal
        open={confirmOpen}
        title="Advance to Next Match"
        message="Advance to the next match? This will finalize the current match result."
        confirmLabel="Advance"
        onConfirm={handleConfirmAdvance}
        onCancel={handleCancelAdvance}
      />
      <h2 style={{ marginBottom: 24 }}>Question Complete</h2>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 32 }}>
        <div
          style={{
            fontSize: '1.4em',
            fontWeight: 'bold',
            color: aWinning ? 'var(--gold, #f5c518)' : '#ccc',
          }}
        >
          {teamA?.name ?? match.teamAId}
          <div style={{ fontSize: '2em', marginTop: 4 }}>{match.scoreA}</div>
        </div>
        <div style={{ fontSize: '1.4em', alignSelf: 'center', color: '#aaa' }}>vs</div>
        <div
          style={{
            fontSize: '1.4em',
            fontWeight: 'bold',
            color: !aWinning ? 'var(--gold, #f5c518)' : '#ccc',
          }}
        >
          {teamB?.name ?? (match.teamBId ?? 'TBD')}
          <div style={{ fontSize: '2em', marginTop: 4 }}>{match.scoreB}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button
          onClick={playAnotherQuestion}
          style={{ padding: '10px 20px' }}
        >
          Play Another Question
        </button>
        <button
          onClick={advanceToNextMatch}
          disabled={!canAdvance}
          style={{
            padding: '10px 20px',
            fontWeight: 'bold',
            opacity: canAdvance ? 1 : 0.5,
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
        >
          &#8594; Advance to Next Match
        </button>
      </div>

      {!canAdvance && match.scoreA === match.scoreB && (
        <p style={{ marginTop: 16, color: '#e55' }}>
          Scores are tied — play another question to break the tie.
        </p>
      )}
    </div>
  );
}
