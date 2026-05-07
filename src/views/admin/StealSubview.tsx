import { useGameState } from '../../hooks/useGameState';
import { currentQuestion, teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function StealSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const qInfo = currentQuestion(state);

  if (!match || !qInfo) {
    return <div className="adm-faceoff"><h2>No active match</h2></div>;
  }

  const { play, def } = qInfo;
  const originalTeamId = play.activeTeamId;
  const stealingTeamId =
    originalTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const stealingTeam = teamById(state, stealingTeamId);

  return (
    <div className="adm-faceoff">
      <div className="adm-faceoff-question">{def.prompt}</div>
      <h2>
        {stealingTeam?.name ?? 'Other team'} — one chance to steal
      </h2>
      <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginTop: -16 }}>
        Click the answer they gave. If it's not on the board, click "Wrong / no match".
      </p>
      <div className="adm-faceoff-board">
        {def.answers.map((answer, idx) => {
          const revealed = play.revealedAnswers.includes(idx);
          return (
            <button
              key={idx}
              className={`adm-faceoff-row ${revealed ? 'taken' : ''}`}
              onClick={() =>
                !revealed &&
                dispatch({ type: 'RESOLVE_STEAL', successful: true, answerIndex: idx })
              }
              disabled={revealed}
            >
              <span className="num">{idx + 1}</span>
              <span className="ans">
                {revealed ? answer.text : answer.text}
              </span>
              <span className="pts">{answer.points}</span>
            </button>
          );
        })}
      </div>
      <div className="adm-faceoff-secondary">
        <button
          className="adm-btn warn"
          onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: false })}
        >
          ✗ Wrong / no match
        </button>
      </div>
    </div>
  );
}
