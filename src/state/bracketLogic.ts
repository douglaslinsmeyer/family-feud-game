import type { TournamentState, Match, MatchPath } from './types';

export function computeWildcard(round1: Match[]): { teamId: string; score: number } {
  let best: { teamId: string; score: number } | null = null;
  for (const m of round1) {
    if (m.winnerId == null || !m.teamBId) continue;
    const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    const loserScore = m.winnerId === m.teamAId ? m.scoreB : m.scoreA;
    if (best === null || loserScore > best.score) {
      best = { teamId: loserId, score: loserScore };
    }
  }
  if (!best) throw new Error('No completed matches in round 1');
  return best;
}

export function getCurrentMatch(state: TournamentState): Match | null {
  const p = state.currentMatchPath;
  if (!p) return null;
  if (p.round === 'round1') return state.bracket.round1[p.index] ?? null;
  if (p.round === 'semis')  return state.bracket.semis[p.index] ?? null;
  if (p.round === 'final')  return state.bracket.final;
  return null;
}

export function isMatchComplete(m: Match): boolean {
  return m.winnerId !== null;
}

export function nextMatchPath(p: MatchPath): MatchPath | null {
  if (p.round === 'round1') {
    if (p.index < 2) return { round: 'round1', index: (p.index + 1) as 0 | 1 | 2 };
    return { round: 'semis', index: 0 };
  }
  if (p.round === 'semis') {
    if (p.index < 1) return { round: 'semis', index: 1 };
    return { round: 'final', index: 0 };
  }
  return null; // final → done
}

export function pickRandom<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
