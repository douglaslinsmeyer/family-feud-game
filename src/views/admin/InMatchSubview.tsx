import { useGameState } from '../../hooks/useGameState';
import { currentQuestion, teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function InMatchSubview() {
  const { state, dispatch } = useGameState();
  const match = getCurrentMatch(state);
  const qInfo = currentQuestion(state);

  if (!match || !qInfo) {
    return <div>No active question</div>;
  }

  const { play, def } = qInfo;
  const teamA = teamById(state, match.teamAId);
  const teamB = match.teamBId ? teamById(state, match.teamBId) : null;

  const isActiveA = play.activeTeamId === match.teamAId;
  const activeTeam = teamById(state, play.activeTeamId);

  const allRevealed = def.answers.length === play.revealedAnswers.length;

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Left: answer board */}
      <div style={{ flex: 1 }}>
        <h3 style={{ marginBottom: 8 }}>{def.prompt}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <tbody>
            {def.answers.map((answer, idx) => {
              const revealed = play.revealedAnswers.includes(idx);
              return (
                <tr
                  key={idx}
                  onClick={() => !revealed && dispatch({ type: 'REVEAL_ANSWER', answerIndex: idx })}
                  style={{
                    cursor: revealed ? 'default' : 'pointer',
                    background: revealed ? 'var(--blue, #1a4a8a)' : 'var(--navy, #0a1a3a)',
                    borderBottom: '2px solid var(--gold-dim, #555)',
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', width: 32 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {revealed ? answer.text : 'Click to reveal'}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: 'var(--gold, #f5c518)',
                    }}
                  >
                    {revealed ? answer.points : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => dispatch({ type: 'AWARD_POINTS_TO_ACTIVE' })}
            disabled={play.revealedAnswers.length === 0}
            title="Award all revealed points to active team"
          >
            Award Points
          </button>
          <button onClick={() => dispatch({ type: 'MARK_STRIKE' })}>
            Strike ✗
          </button>
          <button onClick={() => dispatch({ type: 'SWITCH_ACTIVE_TEAM' })}>
            Switch Team
          </button>
          <button onClick={() => dispatch({ type: 'SKIP_QUESTION' })}>
            Skip Question
          </button>
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.actionStack.length === 0}
          >
            Undo
          </button>
        </div>

        {allRevealed && (
          <div
            style={{
              marginTop: 12,
              padding: 8,
              background: 'var(--gold, #f5c518)',
              color: '#000',
              fontWeight: 'bold',
              borderRadius: 4,
            }}
          >
            All answers revealed!
          </div>
        )}
      </div>

      {/* Right: team panels */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Team A */}
        <div
          style={{
            border: `3px solid ${isActiveA ? 'var(--gold, #f5c518)' : 'var(--gold-dim, #555)'}`,
            borderRadius: 8,
            padding: 12,
            background: isActiveA ? 'rgba(245,197,24,0.08)' : 'transparent',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: 4 }}>
            {teamA?.name ?? match.teamAId}
            {isActiveA && (
              <span style={{ marginLeft: 8, color: 'var(--gold, #f5c518)' }}>
                (Active)
              </span>
            )}
          </div>
          <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
            {match.scoreA}
          </div>
          <div style={{ marginTop: 4, color: '#e55' }}>
            {'✗'.repeat(play.strikesA)}
          </div>
        </div>

        {/* Team B */}
        {teamB && match.teamBId && (
          <div
            style={{
              border: `3px solid ${!isActiveA ? 'var(--gold, #f5c518)' : 'var(--gold-dim, #555)'}`,
              borderRadius: 8,
              padding: 12,
              background: !isActiveA ? 'rgba(245,197,24,0.08)' : 'transparent',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: 4 }}>
              {teamB.name}
              {!isActiveA && (
                <span style={{ marginLeft: 8, color: 'var(--gold, #f5c518)' }}>
                  (Active)
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>
              {match.scoreB}
            </div>
            <div style={{ marginTop: 4, color: '#e55' }}>
              {'✗'.repeat(play.strikesB)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: '0.85em', color: '#aaa' }}>
          Active: {activeTeam?.name ?? play.activeTeamId ?? '—'}
        </div>
      </div>
    </div>
  );
}
