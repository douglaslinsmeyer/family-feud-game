import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import type { Team } from '../../src/state/types';

const T = (id: string, name: string): Team => ({ id, name, members: [] });

describe('reducer: SET_TEAMS', () => {
  it('replaces the teams array', () => {
    const teams = [T('a', 'A'), T('b', 'B'), T('c', 'C'), T('d', 'D'), T('e', 'E'), T('f', 'F')];
    const next = reducer(initialState(), { type: 'SET_TEAMS', teams });
    expect(next.teams).toEqual(teams);
    expect(next.status).toBe('setup');
  });
});

describe('reducer: START_TOURNAMENT', () => {
  it('requires 6 teams to start', () => {
    expect(() => reducer(initialState(), { type: 'START_TOURNAMENT' }))
      .toThrow(/6 teams/i);
  });

  it('with 6 teams, builds round-1 matches and moves status', () => {
    const teams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));
    const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams });
    const next = reducer(withTeams, { type: 'START_TOURNAMENT' });
    expect(next.status).toBe('in_progress');
    expect(next.bracket.round1).toHaveLength(3);
    expect(next.bracket.round1[0].teamAId).toBe('a');
    expect(next.bracket.round1[0].teamBId).toBe('b');
    expect(next.currentMatchPath).toEqual({ round: 'round1', index: 0 });
    expect(next.currentMatchState).toBe('face_off');
  });
});
