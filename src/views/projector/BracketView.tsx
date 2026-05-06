import type { TournamentState, Match } from '../../state/types';

interface MatchCardProps {
  m: Match | null;
  label: string;
  isLive?: boolean;
  teamName: (id: string | null) => string;
}

function MatchCard({ m, label, isLive, teamName }: MatchCardProps) {
  if (!m) return <div style={{ padding: 8, border: '1px dashed var(--gold-dim)' }}>{label}: TBD</div>;
  const aWon = m.winnerId === m.teamAId;
  const bWon = m.winnerId === m.teamBId;
  return (
    <div style={{ padding: 8, border: `2px solid ${isLive ? 'white' : 'var(--gold)'}`, background: 'var(--bg-card)', marginBottom: 8 }}>
      <div style={{ fontSize: 10 }}>{label}</div>
      <div style={{ background: aWon ? 'var(--gold)' : undefined, color: aWon ? 'var(--bg-deep)' : undefined, textDecoration: bWon && m.winnerId ? 'line-through' : undefined }}>
        {teamName(m.teamAId)} — {m.scoreA}
      </div>
      <div style={{ background: bWon ? 'var(--gold)' : undefined, color: bWon ? 'var(--bg-deep)' : undefined, textDecoration: aWon && m.winnerId ? 'line-through' : undefined }}>
        {teamName(m.teamBId)} — {m.scoreB}
      </div>
    </div>
  );
}

export function BracketView({ state }: { state: TournamentState }) {
  const { round1, semis, final, wildcard } = state.bracket;
  const teamName = (id: string | null) => state.teams.find(t => t.id === id)?.name ?? '—';

  const livePath = state.currentMatchPath;
  const isLive = (round: string, idx: number) => livePath?.round === round && livePath?.index === idx;

  return (
    <div style={{ height: '100vh', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
      <div>
        <h3>ROUND 1</h3>
        <MatchCard m={round1[0] ?? null} label="Match 1" isLive={isLive('round1', 0)} teamName={teamName} />
        <MatchCard m={round1[1] ?? null} label="Match 2" isLive={isLive('round1', 1)} teamName={teamName} />
        <MatchCard m={round1[2] ?? null} label="Match 3" isLive={isLive('round1', 2)} teamName={teamName} />
        <div style={{ padding: 8, border: '2px dashed var(--purple)', marginTop: 12 }}>
          ★ WILD CARD: {wildcard.teamId ? teamName(wildcard.teamId) : '—'}
        </div>
      </div>
      <div>
        <h3>SEMIFINALS</h3>
        <MatchCard m={semis[0] ?? null} label="Semi 1" isLive={isLive('semis', 0)} teamName={teamName} />
        <MatchCard m={semis[1] ?? null} label="Semi 2" isLive={isLive('semis', 1)} teamName={teamName} />
      </div>
      <div>
        <h3>FINAL</h3>
        <MatchCard m={final} label="Championship" isLive={isLive('final', 0)} teamName={teamName} />
      </div>
    </div>
  );
}
