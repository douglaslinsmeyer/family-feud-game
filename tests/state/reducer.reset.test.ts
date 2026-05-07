import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import type { Team, TournamentState } from '../../src/state/types';

const T = (id: string, name: string): Team => ({ id, name, members: [] });
const sixTeams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));

function midTournament(): TournamentState {
  const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(withTeams, { type: 'START_TOURNAMENT' });
}

describe('reducer: RESET_GAME', () => {
  it('clears teams and bracket but preserves tournamentId and createdAt', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESET_GAME' });

    expect(after.tournamentId).toBe(before.tournamentId);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.teams).toEqual([]);
    expect(after.status).toBe('setup');
    expect(after.bracket.round1).toEqual([]);
    expect(after.bracket.semis).toEqual([]);
    expect(after.bracket.final).toBeNull();
    expect(after.bracket.fastMoney).toBeNull();
    expect(after.bracket.champion).toBeNull();
    expect(after.bracket.wildcard).toEqual({ teamId: null, score: null });
    expect(after.currentMatchPath).toBeNull();
    expect(after.currentMatchState).toBe('face_off');
    expect(after.actionStack).toEqual([]);
    expect(after.matchStartSnapshot).toBeNull();
    expect(after.projectorView).toBe('game');
  });

  it('updates updatedAt to now', () => {
    const before = midTournament();
    const earlier = before.updatedAt;
    const after = reducer({ ...before, updatedAt: earlier - 1000 }, { type: 'RESET_GAME' });
    expect(after.updatedAt).toBeGreaterThanOrEqual(earlier);
  });

  it('restores a full question pool', () => {
    const before = midTournament();
    expect(before.questionPool.used.length).toBeGreaterThan(0);
    const after = reducer(before, { type: 'RESET_GAME' });
    expect(after.questionPool.used).toEqual([]);
    expect(after.questionPool.available.length).toBe(initialState().questionPool.available.length);
    expect(after.fastMoneyPool.used).toEqual([]);
  });

  it('is idempotent on an already-empty state', () => {
    const empty = initialState();
    const after = reducer(empty, { type: 'RESET_GAME' });
    expect(after.teams).toEqual([]);
    expect(after.status).toBe('setup');
    expect(after.tournamentId).toBe(empty.tournamentId);
  });
});

describe('reducer: RESTART_GAME', () => {
  it('preserves teams verbatim while clearing bracket', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.teams).toEqual(sixTeams);
    expect(after.status).toBe('setup');
    expect(after.bracket.round1).toEqual([]);
    expect(after.bracket.semis).toEqual([]);
    expect(after.bracket.final).toBeNull();
    expect(after.currentMatchPath).toBeNull();
    expect(after.actionStack).toEqual([]);
  });

  it('preserves tournamentId and createdAt', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.tournamentId).toBe(before.tournamentId);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('restores a full question pool', () => {
    const before = midTournament();
    const after = reducer(before, { type: 'RESTART_GAME' });
    expect(after.questionPool.used).toEqual([]);
    expect(after.fastMoneyPool.used).toEqual([]);
    expect(after.questionPool.available.length).toBe(initialState().questionPool.available.length);
    expect(after.fastMoneyPool.available.length).toBe(initialState().fastMoneyPool.available.length);
  });
});
