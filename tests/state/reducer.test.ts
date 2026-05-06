import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import type { Team } from '../../src/state/types';
import { QUESTIONS } from '../../src/content/questions';

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

// ── Shared helpers used by Tasks 10–16 ──────────────────────────────────────
const sixTeams = ['a','b','c','d','e','f'].map(c => ({ id: c, name: c.toUpperCase(), members: [] }));

function startedTournament() {
  let s = initialState();
  s = reducer(s, { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(s, { type: 'START_TOURNAMENT' });
}

// ── Task 10: RESOLVE_FACE_OFF ────────────────────────────────────────────────
describe('reducer: RESOLVE_FACE_OFF', () => {
  it('starts a question with the buzzed-in team active and moves to board_play', () => {
    const s = startedTournament();
    const next = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    expect(next.currentMatchState).toBe('board_play');
    const r1m1 = next.bracket.round1[0];
    expect(r1m1.questions).toHaveLength(1);
    expect(r1m1.questions[0].activeTeamId).toBe('a');
    expect(r1m1.questions[0].revealedAnswers).toEqual([]);
  });

  it('picks a random unused question from the main pool', () => {
    const s = startedTournament();
    const before = s.questionPool.available.length;
    const next = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    expect(next.questionPool.used).toHaveLength(1);
    expect(next.questionPool.available).toHaveLength(before - 1);
  });
});
