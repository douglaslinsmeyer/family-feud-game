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
    <div className="adm-faceoff">
      <h2>Face-Off — Who answered first?</h2>
      <div className="adm-faceoff-buttons">
        <button className="adm-faceoff-btn" onClick={() => resolve(match.teamAId)}>
          {teamA?.name ?? match.teamAId}
          <span className="sub">Score: {match.scoreA}</span>
        </button>
        <button
          className="adm-faceoff-btn"
          onClick={() => match.teamBId && resolve(match.teamBId)}
          disabled={!match.teamBId}
        >
          {teamB?.name ?? (match.teamBId ?? 'TBD')}
          <span className="sub">Score: {match.scoreB}</span>
        </button>
      </div>
    </div>
  );
}
