import { useGameState } from '../../hooks/useGameState';
import { teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function FaceOffSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);

  if (!match) {
    return <div>No active match</div>;
  }

  const teamA = teamById(state, match.teamAId);
  const teamB = teamById(state, match.teamBId);

  function resolve(teamId: string) {
    dispatch({ type: 'RESOLVE_FACE_OFF', teamId });
  }

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <h2 style={{ marginBottom: 32 }}>Face-Off — Who answered first?</h2>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
        <button
          onClick={() => resolve(match.teamAId)}
          style={{
            fontSize: '2rem',
            padding: '32px 48px',
            minWidth: 200,
            fontWeight: 'bold',
          }}
        >
          {teamA?.name ?? match.teamAId}
          <div style={{ fontSize: '1rem', marginTop: 8, color: '#aaa' }}>
            Score: {match.scoreA}
          </div>
        </button>
        <button
          onClick={() => match.teamBId && resolve(match.teamBId)}
          disabled={!match.teamBId}
          style={{
            fontSize: '2rem',
            padding: '32px 48px',
            minWidth: 200,
            fontWeight: 'bold',
            opacity: match.teamBId ? 1 : 0.4,
            cursor: match.teamBId ? 'pointer' : 'not-allowed',
          }}
        >
          {teamB?.name ?? (match.teamBId ?? 'TBD')}
          <div style={{ fontSize: '1rem', marginTop: 8, color: '#aaa' }}>
            Score: {match.scoreB}
          </div>
        </button>
      </div>
    </div>
  );
}
