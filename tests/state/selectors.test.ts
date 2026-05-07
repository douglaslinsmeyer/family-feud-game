import { describe, it, expect } from 'vitest';
import { teamById, currentQuestion, canAdvanceMatch } from '../../src/state/selectors';
import { initialState } from '../../src/state/initialState';
import { reducer } from '../../src/state/reducer';

const sixTeams = ['a','b','c','d','e','f'].map(c => ({ id: c, name: c.toUpperCase(), members: [] }));

function startedTournament() {
  let s = initialState();
  s = reducer(s, { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(s, { type: 'START_TOURNAMENT' });
}

describe('teamById', () => {
  it('returns the matching team', () => {
    const s = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
    const t = teamById(s, 'c');
    expect(t).toBeDefined();
    expect(t!.name).toBe('C');
  });

  it('returns undefined for unknown id', () => {
    const s = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
    expect(teamById(s, 'z')).toBeUndefined();
  });

  it('returns undefined for null id', () => {
    const s = initialState();
    expect(teamById(s, null)).toBeUndefined();
  });
});

describe('currentQuestion', () => {
  it('returns null when no current match', () => {
    const s = initialState();
    expect(currentQuestion(s)).toBeNull();
  });

  it('returns null when match has no questions yet', () => {
    const s = startedTournament();
    expect(currentQuestion(s)).toBeNull();
  });

  it('returns the active play and its definition after face-off', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const result = currentQuestion(s);
    expect(result).not.toBeNull();
    expect(result!.play.activeTeamId).toBe('a');
    expect(result!.def.answers).toHaveLength(5);
  });
});

describe('canAdvanceMatch', () => {
  it('returns false in face_off state', () => {
    const s = startedTournament();
    expect(canAdvanceMatch(s)).toBe(false);
  });

  it('returns false when scores are tied', () => {
    // board_play with no points awarded yet
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    // Force scores to be equal (they start at 0,0)
    expect(canAdvanceMatch(s)).toBe(false);
  });

  it('returns true after AWARD_POINTS_TO_ACTIVE with non-zero score', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    expect(s.currentMatchState).toBe('awarded');
    expect(canAdvanceMatch(s)).toBe(true);
  });
});
