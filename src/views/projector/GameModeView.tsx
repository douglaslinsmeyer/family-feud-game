import type { TournamentState } from '../../state/types';
import { QUESTIONS } from '../../content/questions';
import { getCurrentMatch } from '../../state/bracketLogic';

export function GameModeView({ state }: { state: TournamentState }) {
  const m = getCurrentMatch(state);
  if (!m) return <div style={{ padding: 48 }}>Tournament not started.</div>;
  const q = m.questions[m.questions.length - 1];
  const def = q && QUESTIONS.find(d => d.id === q.questionId);
  const a = state.teams.find(t => t.id === m.teamAId);
  const b = state.teams.find(t => t.id === m.teamBId);
  const activeIsA = q?.activeTeamId === m.teamAId;
  const strikes = activeIsA ? q?.strikesA : q?.strikesB;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <h1 style={{ textAlign: 'center', fontFamily: 'Bebas Neue', textShadow: '0 0 12px var(--gold)' }}>
        {def?.prompt ?? 'Waiting for face-off…'}
      </h1>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {def?.answers.map((ans, i) => {
          const revealed = q?.revealedAnswers.includes(i);
          return (
            <div key={i} style={{
              flex: 1,
              background: revealed ? 'linear-gradient(180deg, var(--gold), var(--gold-2))' : 'var(--bg-card)',
              color: revealed ? 'var(--bg-deep)' : 'var(--gold)',
              border: `2px solid var(--gold)`,
              padding: 16,
              fontSize: 28,
              fontFamily: 'Fjalla One',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{revealed ? ans.text : i + 1}</span>
              <span>{revealed ? ans.points : ''}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24 }}>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--gold)', color: 'var(--bg-deep)', padding: 12, border: activeIsA ? '3px solid var(--white)' : 'none' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18 }}>{a?.name}</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 48 }}>{m.scoreA}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 40, height: 40, border: '2px solid var(--red)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: 28, opacity: i < (strikes ?? 0) ? 1 : 0.2 }}>X</div>
          ))}
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--gold)', color: 'var(--bg-deep)', padding: 12, border: !activeIsA ? '3px solid var(--white)' : 'none' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18 }}>{b?.name}</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 48 }}>{m.scoreB}</div>
        </div>
      </div>
    </div>
  );
}
