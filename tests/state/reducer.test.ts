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

// ── Task 11: REVEAL_ANSWER ───────────────────────────────────────────────────
describe('reducer: REVEAL_ANSWER', () => {
  it('reveals an answer index on the active question', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const m = next.bracket.round1[0];
    expect(m.questions[0].revealedAnswers).toEqual([0]);
  });

  it('does not duplicate an already-revealed answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const next = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const m = next.bracket.round1[0];
    expect(m.questions[0].revealedAnswers).toEqual([0]);
  });
});

// ── Task 12: MARK_STRIKE + SWITCH_ACTIVE_TEAM ────────────────────────────────
describe('reducer: MARK_STRIKE', () => {
  it('increments strikes for active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'MARK_STRIKE' });
    expect(next.bracket.round1[0].questions[0].strikesA).toBe(1);
    expect(next.currentMatchState).toBe('board_play');
  });

  it('on third strike, transitions to steal state', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    expect(s.currentMatchState).toBe('steal');
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(3);
  });
});

describe('reducer: SWITCH_ACTIVE_TEAM', () => {
  it('flips the active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'SWITCH_ACTIVE_TEAM' });
    expect(next.bracket.round1[0].questions[0].activeTeamId).toBe('b');
  });
});

// ── Task 13: AWARD_POINTS_TO_ACTIVE + RESOLVE_STEAL ──────────────────────────
function pointsForRevealed(questionId: string, indices: number[]) {
  const q = QUESTIONS.find(q => q.id === questionId)!;
  return indices.reduce((sum, i) => sum + q.answers[i].points, 0);
}

describe('reducer: AWARD_POINTS_TO_ACTIVE', () => {
  it('adds revealed-answer points to active team and marks question awarded', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    const next = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    const m = next.bracket.round1[0];
    const q = m.questions[0];
    const expected = pointsForRevealed(q.questionId, [0, 1]);
    expect(m.scoreA).toBe(expected);
    expect(q.pointsAwardedTo).toBe('a');
    expect(next.currentMatchState).toBe('awarded');
  });
});

describe('reducer: RESOLVE_STEAL', () => {
  it('successful steal awards points to opponent', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' }); // → steal
    const next = reducer(s, { type: 'RESOLVE_STEAL', successful: true });
    const m = next.bracket.round1[0];
    const q = m.questions[0];
    expect(m.scoreB).toBeGreaterThan(0);
    expect(m.scoreA).toBe(0);
    expect(q.stealAttempted).toBe(true);
    expect(q.stealSuccessful).toBe(true);
    expect(q.pointsAwardedTo).toBe('b');
    expect(next.currentMatchState).toBe('awarded');
  });

  it('failed steal awards points to original active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    const next = reducer(s, { type: 'RESOLVE_STEAL', successful: false });
    const m = next.bracket.round1[0];
    expect(m.scoreA).toBeGreaterThan(0);
    expect(m.scoreB).toBe(0);
    expect(next.currentMatchState).toBe('awarded');
  });
});

// ── Task 14: ADVANCE_MATCH ───────────────────────────────────────────────────
describe('reducer: ADVANCE_MATCH', () => {
  function playOutMatch(s: ReturnType<typeof startedTournament>, winnerId: string) {
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: winnerId });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 2 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 3 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 4 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    return reducer(s, { type: 'ADVANCE_MATCH' });
  }

  it('determines winner by higher score and moves to next match', () => {
    let s = startedTournament();
    s = playOutMatch(s, 'a');
    expect(s.bracket.round1[0].winnerId).toBe('a');
    expect(s.currentMatchPath).toEqual({ round: 'round1', index: 1 });
    expect(s.currentMatchState).toBe('face_off');
  });

  it('after round 1 completes, computes wildcard and seeds semis', () => {
    let s = startedTournament();
    s = playOutMatch(s, 'a');  // a beats b
    s = playOutMatch(s, 'd');  // d beats c
    s = playOutMatch(s, 'f');  // f beats e
    expect(s.bracket.wildcard.teamId).not.toBeNull();
    expect(s.bracket.semis).toHaveLength(2);
    expect(s.bracket.semis[0].teamAId).toBe('a');
    expect(s.bracket.semis[0].teamBId).toBe('d');
    expect(s.bracket.semis[1].teamAId).toBe('f');
    expect(s.bracket.semis[1].teamBId).toBe(s.bracket.wildcard.teamId);
    expect(s.bracket.semis[1].isWildcardEntry).toBe(true);
    expect(s.currentMatchPath).toEqual({ round: 'semis', index: 0 });
  });
});

// ── Task 15: UNDO ────────────────────────────────────────────────────────────
describe('reducer: UNDO', () => {
  it('reverts the last action by replaying the stack from the start of the match', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(1);
    s = reducer(s, { type: 'UNDO' });
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(0);
    expect(s.bracket.round1[0].questions[0].revealedAnswers).toEqual([0]);
  });
});

// ── Task 16: SET_PROJECTOR_VIEW + SKIP_QUESTION + Fast Money ─────────────────
describe('reducer: SET_PROJECTOR_VIEW', () => {
  it('toggles between game and bracket', () => {
    const s = initialState();
    expect(reducer(s, { type: 'SET_PROJECTOR_VIEW', view: 'bracket' }).projectorView).toBe('bracket');
  });
});

describe('reducer: SKIP_QUESTION', () => {
  it('discards the current question and returns to face-off', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'SKIP_QUESTION' });
    expect(next.bracket.round1[0].questions).toHaveLength(0);
    expect(next.currentMatchState).toBe('face_off');
  });
});

describe('reducer: Fast Money', () => {
  it("SUBMIT_FM_ANSWER appends to the player's answers", () => {
    const s = {
      ...initialState(),
      bracket: {
        ...initialState().bracket,
        fastMoney: { player1: [], player2: [], totalScore: 0, won: false },
      },
    };
    const next = reducer(s, { type: 'SUBMIT_FM_ANSWER', player: 1, answer: { text: 'Coffee', points: 52 } });
    expect(next.bracket.fastMoney!.player1).toHaveLength(1);
  });

  it('SUBMIT_FM_ANSWER lazy-initializes fastMoney when null', () => {
    // fastMoney starts as null in initialState; the reducer should auto-init.
    const s = initialState();
    expect(s.bracket.fastMoney).toBeNull();
    const next = reducer(s, { type: 'SUBMIT_FM_ANSWER', player: 1, answer: { text: 'Coffee', points: 52 } });
    expect(next.bracket.fastMoney).not.toBeNull();
    expect(next.bracket.fastMoney!.player1).toHaveLength(1);
    expect(next.bracket.fastMoney!.player2).toHaveLength(0);
  });

  it('COMPLETE_FAST_MONEY sets won=true if total >= 200', () => {
    const base = initialState();
    const s = {
      ...base,
      bracket: {
        ...base.bracket,
        fastMoney: {
          player1: [{ text: 'a', points: 120 }],
          player2: [{ text: 'b', points: 80 }],
          totalScore: 0,
          won: false,
        },
      },
    };
    const next = reducer(s, { type: 'COMPLETE_FAST_MONEY' });
    expect(next.bracket.fastMoney!.totalScore).toBe(200);
    expect(next.bracket.fastMoney!.won).toBe(true);
  });
});
