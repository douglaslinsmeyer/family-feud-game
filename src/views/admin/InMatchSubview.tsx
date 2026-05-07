import { useGameState } from '../../hooks/useGameState';
import { currentQuestion, teamById, canAdvanceMatch } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function InMatchSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const qInfo = currentQuestion(state);
  const canAdvance = canAdvanceMatch(state);

  if (!match || !qInfo) {
    return <div>No active question</div>;
  }

  const { play, def } = qInfo;
  const teamA = teamById(state, match.teamAId);
  const teamB = match.teamBId ? teamById(state, match.teamBId) : null;

  const isActiveA = play.activeTeamId === match.teamAId;
  const allRevealed = def.answers.length === play.revealedAnswers.length;

  return (
    <div className="adm-body-columns">
      {/* Left: answer board */}
      <div className="adm-board-col">
        <div className="adm-question">{def.prompt}</div>
        <div className="adm-board">
          {def.answers.map((answer, idx) => {
            const revealed = play.revealedAnswers.includes(idx);
            return (
              <div
                key={idx}
                className={`adm-row ${revealed ? 'revealed' : 'hidden'}`}
                onClick={() => !revealed && dispatch({ type: 'REVEAL_ANSWER', answerIndex: idx })}
              >
                <span className="num">{idx + 1}</span>
                <span className="ans">{answer.text}</span>
                {!revealed && <span className="reveal-hint">click to reveal</span>}
                <span className="pts">{answer.points}</span>
              </div>
            );
          })}
        </div>
        {allRevealed && (
          <div style={{ padding: '6px 10px', background: 'rgba(255,215,0,0.1)', border: '1px solid var(--gold)', borderRadius: 4, fontSize: 12, color: 'var(--gold)', textAlign: 'center' }}>
            All answers revealed
          </div>
        )}
      </div>

      {/* Right: controls */}
      <div className="adm-controls">
        {/* Teams + strikes */}
        <div className="adm-teams">
          <div
            className={`adm-team-card ${isActiveA ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SWITCH_ACTIVE_TEAM' })}
            title="Click to switch active team"
          >
            <div className="name">{teamA?.name ?? match.teamAId}</div>
            <div className="score">{match.scoreA}</div>
            <div className="label">{isActiveA ? 'Active · click to switch' : 'click to switch'}</div>
          </div>

          <div className="adm-strikes">
            <div className="x-row">
              {[0, 1, 2].map(i => (
                <div key={i} className={`x ${i < (isActiveA ? play.strikesA : play.strikesB) ? 'lit' : ''}`}>X</div>
              ))}
            </div>
            <div className="strike-label">strikes</div>
          </div>

          {teamB && match.teamBId ? (
            <div
              className={`adm-team-card ${!isActiveA ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SWITCH_ACTIVE_TEAM' })}
              title="Click to switch active team"
            >
              <div className="name">{teamB.name}</div>
              <div className="score">{match.scoreB}</div>
              <div className="label">{!isActiveA ? 'Active · click to switch' : 'click to switch'}</div>
            </div>
          ) : (
            <div className="adm-team-card" style={{ opacity: 0.4 }}>
              <div className="name">TBD</div>
              <div className="score">—</div>
            </div>
          )}
        </div>

        {/* Action grid */}
        <div className="adm-action-grid">
          <button
            className="adm-btn"
            onClick={() => dispatch({ type: 'AWARD_POINTS_TO_ACTIVE' })}
            disabled={play.revealedAnswers.length === 0}
            title="Award all revealed points to active team"
          >
            Award Points
          </button>
          <button
            className="adm-btn warn"
            onClick={() => dispatch({ type: 'MARK_STRIKE' })}
          >
            ✗ Strike
          </button>
          <button
            className="adm-btn"
            onClick={() => dispatch({ type: 'SKIP_QUESTION' })}
          >
            ↺ Skip Question
          </button>
          <button
            className="adm-btn warn"
            onClick={() => dispatch({ type: 'START_STEAL' })}
          >
            ⚐ Steal
          </button>
        </div>

        {/* Advance CTA */}
        {canAdvance && (
          <button className="adm-next" onClick={() => dispatch({ type: 'ADVANCE_MATCH' })}>
            → NEXT MATCH
            <span className="sub">win condition met</span>
          </button>
        )}
      </div>
    </div>
  );
}
