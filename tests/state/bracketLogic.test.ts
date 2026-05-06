import { describe, it, expect } from 'vitest';
import { computeWildcard, getCurrentMatch, isMatchComplete, nextMatchPath } from '../../src/state/bracketLogic';
import type { Match } from '../../src/state/types';
import { initialState } from '../../src/state/initialState';

const completedMatch = (a: string, b: string, scoreA: number, scoreB: number): Match => ({
  teamAId: a, teamBId: b, questions: [], scoreA, scoreB,
  winnerId: scoreA > scoreB ? a : b,
});

describe('computeWildcard', () => {
  it('returns the highest-scoring losing team across round 1', () => {
    const r1: Match[] = [
      completedMatch('a', 'b', 100, 90),  // b loses with 90
      completedMatch('c', 'd', 80, 95),   // c loses with 80
      completedMatch('e', 'f', 70, 110),  // e loses with 70
    ];
    const result = computeWildcard(r1);
    expect(result.teamId).toBe('b');
    expect(result.score).toBe(90);
  });

  it('handles ties by picking the first encountered', () => {
    const r1: Match[] = [
      completedMatch('a', 'b', 100, 90),
      completedMatch('c', 'd', 80, 100),
      completedMatch('e', 'f', 90, 100),
    ];
    expect(computeWildcard(r1).teamId).toBe('b');
  });
});

describe('nextMatchPath', () => {
  it('round1.0 → round1.1', () => {
    expect(nextMatchPath({ round: 'round1', index: 0 })).toEqual({ round: 'round1', index: 1 });
  });
  it('round1.1 → round1.2', () => {
    expect(nextMatchPath({ round: 'round1', index: 1 })).toEqual({ round: 'round1', index: 2 });
  });
  it('round1.2 → semis.0', () => {
    expect(nextMatchPath({ round: 'round1', index: 2 })).toEqual({ round: 'semis', index: 0 });
  });
  it('semis.0 → semis.1', () => {
    expect(nextMatchPath({ round: 'semis', index: 0 })).toEqual({ round: 'semis', index: 1 });
  });
  it('semis.1 → final.0', () => {
    expect(nextMatchPath({ round: 'semis', index: 1 })).toEqual({ round: 'final', index: 0 });
  });
  it('final.0 → null (tournament done)', () => {
    expect(nextMatchPath({ round: 'final', index: 0 })).toBeNull();
  });
});

describe('getCurrentMatch', () => {
  it('returns null when no currentMatchPath', () => {
    const state = initialState();
    expect(getCurrentMatch(state)).toBeNull();
  });
});

describe('isMatchComplete', () => {
  it('returns false when winnerId is null', () => {
    const m: Match = { teamAId: 'a', teamBId: 'b', questions: [], scoreA: 0, scoreB: 0, winnerId: null };
    expect(isMatchComplete(m)).toBe(false);
  });
  it('returns true when winnerId is set', () => {
    const m = completedMatch('a', 'b', 10, 5);
    expect(isMatchComplete(m)).toBe(true);
  });
});
