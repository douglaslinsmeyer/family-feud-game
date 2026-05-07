import type { TournamentState, Match } from '../../state/types';
import { WinFanfare } from './WinFanfare';
import './BracketView.css';

interface TeamRowProps {
  teamId: string | null;
  score: number;
  winnerId: string | null;
  isWildcardEntry?: boolean;
  wildcardTeamId?: string | null;
}

function TeamRow({ teamId, score, winnerId, isWildcardEntry, wildcardTeamId }: TeamRowProps) {
  const hasResult = winnerId !== null;
  const isWinner = hasResult && winnerId === teamId;
  const isLoser = hasResult && winnerId !== teamId;
  const isTbd = !teamId;

  let cls = '';
  if (isTbd) cls = 'tbd';
  else if (isWinner) cls = 'winner';
  else if (isLoser) cls = 'loser';

  const showWcPill = isWildcardEntry && teamId === wildcardTeamId;

  return (
    <div className={`brk-team ${cls}`}>
      <span className="name">
        {showWcPill && <span className="wc-pill">★ WC</span>}
        {teamId ?? 'TBD'}
      </span>
      <span className="score">{hasResult || score > 0 ? score : '—'}</span>
    </div>
  );
}

interface MatchCardProps {
  m: Match | null;
  label: string;
  isLive?: boolean;
  isPending?: boolean;
  isFinal?: boolean;
  teamName: (id: string | null) => string;
  wildcardTeamId?: string | null;
}

function MatchCard({ m, label, isLive, isPending, isFinal, teamName, wildcardTeamId }: MatchCardProps) {
  if (!m) {
    return (
      <div className={`brk-match pending ${isFinal ? 'final' : ''}`}>
        <span className="brk-match-label">{label}</span>
        <div className="brk-team tbd"><span className="name">TBD</span><span className="score">—</span></div>
        <div className="brk-team tbd"><span className="name">TBD</span><span className="score">—</span></div>
      </div>
    );
  }

  const matchCls = [
    'brk-match',
    isFinal ? 'final' : '',
    isLive ? 'live' : '',
    isPending ? 'pending' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={matchCls}>
      <span className="brk-match-label">{label}</span>
      {isLive && <span className="brk-live-tag">LIVE</span>}
      <TeamRow
        teamId={m.teamAId ? teamName(m.teamAId) : null}
        score={m.scoreA}
        winnerId={m.winnerId ? teamName(m.winnerId) : null}
      />
      <TeamRow
        teamId={m.teamBId ? teamName(m.teamBId) : null}
        score={m.scoreB}
        winnerId={m.winnerId ? teamName(m.winnerId) : null}
        isWildcardEntry={m.isWildcardEntry}
        wildcardTeamId={wildcardTeamId ? teamName(wildcardTeamId) : null}
      />
    </div>
  );
}

export function BracketView({ state }: { state: TournamentState }) {
  const { round1, semis, final, wildcard, champion } = state.bracket;
  const teamName = (id: string | null) => state.teams.find(t => t.id === id)?.name ?? (id ?? '—');
  const championName = champion ? teamName(champion) : null;

  const livePath = state.currentMatchPath;
  const isLive = (round: string, idx: number) => livePath?.round === round && livePath?.index === idx;
  const isPending = (m: Match | null) => m !== null && m.winnerId === null && !isLive(
    round1.includes(m) ? 'round1' : semis.includes(m) ? 'semis' : 'final',
    round1.includes(m) ? round1.indexOf(m) : semis.includes(m) ? semis.indexOf(m) : 0,
  );

  const wcTeamName = wildcard.teamId ? teamName(wildcard.teamId) : null;

  return (
    <div className="brk-stage">
      <WinFanfare teamName={championName} />
      <div className="brk-title">EGPS FAMILY FEUD · TOURNAMENT BRACKET</div>

      <div className="brk-headers">
        <div>ROUND 1</div>
        <div>SEMIFINALS</div>
        <div className="col-final">FINAL</div>
      </div>

      <div className="brk-tree">

        {/* ROUND 1 */}
        <div className="brk-round">
          {/* Pair 1: Match 1 + Match 2 */}
          <div className="brk-pair">
            <MatchCard
              m={round1[0] ?? null}
              label="Match 1"
              isLive={isLive('round1', 0)}
              isPending={isPending(round1[0] ?? null)}
              teamName={teamName}
            />
            <MatchCard
              m={round1[1] ?? null}
              label="Match 2"
              isLive={isLive('round1', 1)}
              isPending={isPending(round1[1] ?? null)}
              teamName={teamName}
            />
          </div>

          {/* Pair 2: Match 3 + Wildcard slot */}
          <div className="brk-pair">
            <MatchCard
              m={round1[2] ?? null}
              label="Match 3"
              isLive={isLive('round1', 2)}
              isPending={isPending(round1[2] ?? null)}
              teamName={teamName}
            />
            {/* Wildcard slot */}
            <div className="brk-match wildcard">
              <span className="brk-match-label">Wild Card</span>
              <div className="brk-wc-row brk-wc-banner">★ WILD CARD ★</div>
              <div className="brk-wc-row brk-wc-team">
                <span className="name">{wcTeamName ?? '—'}</span>
                <span className="score">{wildcard.score != null ? wildcard.score : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SEMIFINALS */}
        <div className="brk-round">
          <div className="brk-pair">
            <MatchCard
              m={semis[0] ?? null}
              label="Semi 1"
              isLive={isLive('semis', 0)}
              isPending={isPending(semis[0] ?? null)}
              teamName={teamName}
            />
            <MatchCard
              m={semis[1] ?? null}
              label="Semi 2"
              isLive={isLive('semis', 1)}
              isPending={isPending(semis[1] ?? null)}
              teamName={teamName}
              wildcardTeamId={wildcard.teamId}
            />
          </div>
        </div>

        {/* FINAL */}
        <div className="brk-round brk-round-final">
          <MatchCard
            m={final}
            label="Final"
            isLive={isLive('final', 0)}
            isPending={isPending(final)}
            isFinal
            teamName={teamName}
          />
        </div>

      </div>

      <div className="brk-footnote">
        <span className="star">★</span> WILD CARD: highest-scoring<br />
        losing team from Round 1
      </div>
    </div>
  );
}
