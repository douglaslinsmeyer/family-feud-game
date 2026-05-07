import { useGameState } from '../../hooks/useGameState';
import { teamById, faceOffStage, currentQuestion } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function FaceOffSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const qInfo = currentQuestion(state);
  const stage = faceOffStage(state);

  if (!match || !qInfo) {
    return <div className="adm-faceoff"><h2>Loading face-off…</h2></div>;
  }

  const { play, def } = qInfo;
  const fo = play.faceOff;
  const teamA = teamById(state, match.teamAId);
  const teamB = teamById(state, match.teamBId);

  const buzzerName = fo.firstBuzzTeamId
    ? teamById(state, fo.firstBuzzTeamId)?.name ?? fo.firstBuzzTeamId
    : '';
  const otherTeamId =
    fo.firstBuzzTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const otherName = otherTeamId
    ? teamById(state, otherTeamId)?.name ?? otherTeamId
    : '';
  const winnerName = fo.winnerId
    ? teamById(state, fo.winnerId)?.name ?? fo.winnerId
    : '';

  return (
    <div className="adm-faceoff">
      <div className="adm-faceoff-question">{def.prompt}</div>

      {stage === 'awaiting_buzz' && (
        <>
          <h2>Who buzzed in first?</h2>
          <div className="adm-faceoff-buttons">
            <button
              className="adm-faceoff-btn"
              onClick={() => dispatch({ type: 'FACEOFF_BUZZ_IN', teamId: match.teamAId })}
            >
              {teamA?.name ?? match.teamAId}
            </button>
            <button
              className="adm-faceoff-btn"
              onClick={() => match.teamBId && dispatch({ type: 'FACEOFF_BUZZ_IN', teamId: match.teamBId })}
              disabled={!match.teamBId}
            >
              {teamB?.name ?? (match.teamBId ?? 'TBD')}
            </button>
          </div>
        </>
      )}

      {(stage === 'awaiting_first_answer' || stage === 'awaiting_second_answer') && (
        <>
          <h2>
            {stage === 'awaiting_first_answer' ? buzzerName : otherName}
            {' — pick their answer'}
          </h2>
          <div className="adm-faceoff-board">
            {def.answers.map((answer, idx) => {
              const alreadyTaken =
                stage === 'awaiting_second_answer' && fo.firstAnswerIndex === idx;
              return (
                <button
                  key={idx}
                  className={`adm-faceoff-row ${alreadyTaken ? 'taken' : ''}`}
                  onClick={() =>
                    dispatch({
                      type:
                        stage === 'awaiting_first_answer'
                          ? 'FACEOFF_FIRST_ANSWER'
                          : 'FACEOFF_SECOND_ANSWER',
                      answerIndex: idx,
                    })
                  }
                  disabled={alreadyTaken}
                >
                  <span className="num">{idx + 1}</span>
                  <span className="ans">{answer.text}</span>
                  <span className="pts">{answer.points}</span>
                </button>
              );
            })}
          </div>
          <div className="adm-faceoff-secondary">
            <button
              className="adm-btn warn"
              onClick={() =>
                dispatch({
                  type:
                    stage === 'awaiting_first_answer'
                      ? 'FACEOFF_FIRST_ANSWER'
                      : 'FACEOFF_SECOND_ANSWER',
                  answerIndex: null,
                })
              }
            >
              ✗ Wrong / no answer
            </button>
          </div>
        </>
      )}

      {stage === 'awaiting_adjudication' && (
        <>
          <h2>Both teams missed — who wins the face-off?</h2>
          <div className="adm-faceoff-buttons">
            <button
              className="adm-faceoff-btn"
              onClick={() => dispatch({ type: 'FACEOFF_ADJUDICATE', winnerId: match.teamAId })}
            >
              {teamA?.name ?? match.teamAId}
            </button>
            <button
              className="adm-faceoff-btn"
              onClick={() => match.teamBId && dispatch({ type: 'FACEOFF_ADJUDICATE', winnerId: match.teamBId })}
              disabled={!match.teamBId}
            >
              {teamB?.name ?? (match.teamBId ?? 'TBD')}
            </button>
          </div>
          <div className="adm-faceoff-secondary">
            <button
              className="adm-btn"
              onClick={() => dispatch({ type: 'SKIP_QUESTION' })}
            >
              ↺ Skip this question
            </button>
          </div>
        </>
      )}

      {stage === 'awaiting_decision' && (
        <>
          <h2>{winnerName} — keep or pass?</h2>
          <div className="adm-faceoff-buttons">
            <button
              className="adm-faceoff-btn"
              onClick={() => dispatch({ type: 'FACEOFF_KEEP' })}
            >
              KEEP
              <span className="sub">{winnerName} plays the board</span>
            </button>
            <button
              className="adm-faceoff-btn"
              onClick={() => dispatch({ type: 'FACEOFF_PASS' })}
            >
              PASS
              <span className="sub">other team plays the board</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
