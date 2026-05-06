import { useGameState } from '../../hooks/useGameState';
import { currentQuestion, teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function StealSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const qInfo = currentQuestion(state);

  if (!match || !qInfo) {
    return <div>No active match</div>;
  }

  const { play } = qInfo;
  // The stealing team is the opponent of whoever got 3 strikes
  const originalTeamId = play.activeTeamId;
  const stealingTeamId =
    originalTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const stealingTeam = teamById(state, stealingTeamId);

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <h2 style={{ marginBottom: 8 }}>Steal Opportunity</h2>
      {stealingTeam && (
        <p style={{ fontSize: '1.2em', marginBottom: 32, color: 'var(--gold, #f5c518)' }}>
          {stealingTeam.name} — one answer to steal!
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
        <button
          onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: true })}
          style={{
            fontSize: '1.8rem',
            padding: '28px 44px',
            fontWeight: 'bold',
            background: '#1a6b1a',
            color: '#fff',
            border: '2px solid #2d9e2d',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          &#10003; Steal SUCCESSFUL
        </button>
        <button
          onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: false })}
          style={{
            fontSize: '1.8rem',
            padding: '28px 44px',
            fontWeight: 'bold',
            background: '#6b1a1a',
            color: '#fff',
            border: '2px solid #9e2d2d',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          &#10007; Steal FAILED
        </button>
      </div>
    </div>
  );
}
