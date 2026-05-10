import { describe, it, expect } from 'vitest';
import { teamById, currentQuestion, canAdvanceMatch, adminBodyKind, isFastMoneyPhase } from '../../src/state/selectors';
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

  it('returns the freshly-picked face-off question after START_TOURNAMENT', () => {
    const s = startedTournament();
    const result = currentQuestion(s);
    expect(result).not.toBeNull();
    expect(result!.play.activeTeamId).toBeNull();
    expect(result!.def.answers).toHaveLength(5);
  });

  it('returns the active play after the face-off resolves', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    const result = currentQuestion(s);
    expect(result).not.toBeNull();
    expect(result!.play.activeTeamId).toBe('a');
  });
});

describe('canAdvanceMatch', () => {
  it('returns false in face_off state', () => {
    const s = startedTournament();
    expect(canAdvanceMatch(s)).toBe(false);
  });

  it('returns false in board_play with tied scores', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    expect(canAdvanceMatch(s)).toBe(false);
  });

  it('returns true after AWARD_POINTS_TO_ACTIVE with non-zero score', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    expect(s.currentMatchState).toBe('awarded');
    expect(canAdvanceMatch(s)).toBe(true);
  });
});

describe('adminBodyKind', () => {
  it('returns "setup" while status is setup', () => {
    expect(adminBodyKind(initialState())).toBe('setup');
  });

  it('returns "faceOff" right after START_TOURNAMENT', () => {
    expect(adminBodyKind(startedTournament())).toBe('faceOff');
  });

  it('returns "fastMoney" once the tournament is done (after the final\'s ADVANCE_MATCH)', () => {
    // Simulate the post-final state directly: status=done, currentMatchPath=null,
    // currentMatchState=match_over. This is exactly what ADVANCE_MATCH produces
    // when nextMatchPath('final') returns null.
    const s = {
      ...startedTournament(),
      status: 'done' as const,
      currentMatchPath: null,
      currentMatchState: 'match_over' as const,
    };
    expect(adminBodyKind(s)).toBe('fastMoney');
  });

  it('returns "steal" during a steal opportunity', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    expect(adminBodyKind(s)).toBe('steal');
  });

  it('returns "between" after AWARD_POINTS_TO_ACTIVE', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    expect(adminBodyKind(s)).toBe('between');
  });

  it('returns "inMatch" during board play', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    expect(adminBodyKind(s)).toBe('inMatch');
  });
});

describe('isFastMoneyPhase', () => {
  it('is false during setup', () => {
    expect(isFastMoneyPhase(initialState())).toBe(false);
  });

  it('is false while a tournament is in progress', () => {
    expect(isFastMoneyPhase(startedTournament())).toBe(false);
  });

  it('is true the moment status flips to "done", before any FM answers are logged', () => {
    // Reproduces the projector vs. admin desync: status='done' but
    // bracket.fastMoney is still null until the first SUBMIT_FM_ANSWER.
    // Both views must agree at this instant.
    const s = {
      ...startedTournament(),
      status: 'done' as const,
      currentMatchPath: null,
      currentMatchState: 'match_over' as const,
    };
    expect(s.bracket.fastMoney).toBeNull();
    expect(isFastMoneyPhase(s)).toBe(true);
    expect(adminBodyKind(s)).toBe('fastMoney');
  });
});
