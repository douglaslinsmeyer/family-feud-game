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
  const originalTeamId = play.activeTeamId;
  const stealingTeamId =
    originalTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const stealingTeam = teamById(state, stealingTeamId);

  return (
    <div className="adm-steal">
      <h2>Steal Opportunity</h2>
      {stealingTeam && (
        <p className="team-name">{stealingTeam.name} — one answer to steal!</p>
      )}
      <div className="adm-steal-buttons">
        <button
          className="adm-steal-btn success"
          onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: true })}
        >
          ✓ Steal SUCCESSFUL
        </button>
        <button
          className="adm-steal-btn fail"
          onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: false })}
        >
          ✗ Steal FAILED
        </button>
      </div>
    </div>
  );
}
