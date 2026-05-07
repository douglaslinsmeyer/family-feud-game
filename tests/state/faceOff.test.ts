import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import { faceOffStage } from '../../src/state/selectors';
import type { Team, TournamentState } from '../../src/state/types';
import { QUESTIONS } from '../../src/content/questions';

const sixTeams: Team[] = ['a', 'b', 'c', 'd', 'e', 'f'].map(c => ({
  id: c,
  name: c.toUpperCase(),
  members: [],
}));

function startedTournament(): TournamentState {
  let s = initialState();
  s = reducer(s, { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(s, { type: 'START_TOURNAMENT' });
}

function currentQuestion(s: TournamentState) {
  const m = s.bracket.round1[0];
  return m.questions[m.questions.length - 1];
}

function questionDef(id: string) {
  return QUESTIONS.find(q => q.id === id)!;
}

// ── Eager question selection on entering face_off ────────────────────────────

describe('face-off: eager question selection', () => {
  it('START_TOURNAMENT creates a QuestionPlay with an empty face-off and picks a question', () => {
    const s = startedTournament();
    const m = s.bracket.round1[0];

    expect(m.questions).toHaveLength(1);
    const q = m.questions[0];
    expect(q.questionId).toBeTruthy();
    expect(q.revealedAnswers).toEqual([]);
    expect(q.activeTeamId).toBeNull();
    expect(q.faceOff).toEqual({
      firstBuzzTeamId: null,
      firstAnswerIndex: null,
      firstAnswerSubmitted: false,
      secondAnswerIndex: null,
      secondAnswerSubmitted: false,
      winnerId: null,
      decision: null,
    });
    expect(s.questionPool.used).toContain(q.questionId);
    expect(s.questionPool.available).not.toContain(q.questionId);
  });

  it('faceOffStage at start is awaiting_buzz', () => {
    const s = startedTournament();
    expect(faceOffStage(s)).toBe('awaiting_buzz');
  });
});

// ── FACEOFF_BUZZ_IN ──────────────────────────────────────────────────────────

describe('face-off: FACEOFF_BUZZ_IN', () => {
  it('records the buzzed-in team and advances stage to awaiting_first_answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    expect(currentQuestion(s).faceOff.firstBuzzTeamId).toBe('a');
    expect(faceOffStage(s)).toBe('awaiting_first_answer');
  });
});

// ── FACEOFF_FIRST_ANSWER ─────────────────────────────────────────────────────

describe('face-off: FACEOFF_FIRST_ANSWER', () => {
  it('with the #1 answer, auto-wins for the buzzed-in team and advances to awaiting_decision', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    const q = currentQuestion(s);
    expect(q.faceOff.firstAnswerSubmitted).toBe(true);
    expect(q.faceOff.firstAnswerIndex).toBe(0);
    expect(q.faceOff.winnerId).toBe('a');
    expect(q.revealedAnswers).toContain(0);
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('with a non-#1 correct answer, leaves winner unresolved and advances to awaiting_second_answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 2 });
    const q = currentQuestion(s);
    expect(q.faceOff.firstAnswerSubmitted).toBe(true);
    expect(q.faceOff.firstAnswerIndex).toBe(2);
    expect(q.faceOff.winnerId).toBeNull();
    expect(q.revealedAnswers).toContain(2);
    expect(faceOffStage(s)).toBe('awaiting_second_answer');
  });

  it('with null (wrong/no answer), does not reveal anything and advances to awaiting_second_answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: null });
    const q = currentQuestion(s);
    expect(q.faceOff.firstAnswerSubmitted).toBe(true);
    expect(q.faceOff.firstAnswerIndex).toBeNull();
    expect(q.revealedAnswers).toEqual([]);
    expect(faceOffStage(s)).toBe('awaiting_second_answer');
  });
});

// ── FACEOFF_SECOND_ANSWER ────────────────────────────────────────────────────

describe('face-off: FACEOFF_SECOND_ANSWER', () => {
  it('second team beats first by points → second team wins', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 4 }); // lowest points
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: 1 }); // higher points
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    expect(def.answers[1].points).toBeGreaterThan(def.answers[4].points);
    expect(q.faceOff.winnerId).toBe('b');
    expect(q.revealedAnswers).toContain(4);
    expect(q.revealedAnswers).toContain(1);
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('second team gives lower-points answer → first team wins', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 1 }); // higher
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: 4 }); // lower
    expect(currentQuestion(s).faceOff.winnerId).toBe('a');
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('first team wrong, second team correct → second team wins', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: null });
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: 3 });
    expect(currentQuestion(s).faceOff.winnerId).toBe('b');
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('first team correct, second team wrong → first team wins', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 3 });
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: null });
    expect(currentQuestion(s).faceOff.winnerId).toBe('a');
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('both wrong → no winner, advances to awaiting_adjudication', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: null });
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: null });
    expect(currentQuestion(s).faceOff.winnerId).toBeNull();
    expect(faceOffStage(s)).toBe('awaiting_adjudication');
  });
});

// ── FACEOFF_ADJUDICATE ───────────────────────────────────────────────────────

describe('face-off: FACEOFF_ADJUDICATE', () => {
  it('host picks a winner after both teams missed', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: null });
    s = reducer(s, { type: 'FACEOFF_SECOND_ANSWER', answerIndex: null });
    s = reducer(s, { type: 'FACEOFF_ADJUDICATE', winnerId: 'b' });
    expect(currentQuestion(s).faceOff.winnerId).toBe('b');
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });
});

// ── FACEOFF_KEEP / FACEOFF_PASS ──────────────────────────────────────────────

describe('face-off: FACEOFF_KEEP and FACEOFF_PASS', () => {
  it('KEEP makes the winning team active and transitions to board_play', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    expect(currentQuestion(s).activeTeamId).toBe('a');
    expect(currentQuestion(s).faceOff.decision).toBe('keep');
    expect(s.currentMatchState).toBe('board_play');
  });

  it('PASS makes the opposing team active and transitions to board_play', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_PASS' });
    expect(currentQuestion(s).activeTeamId).toBe('b');
    expect(currentQuestion(s).faceOff.decision).toBe('pass');
    expect(s.currentMatchState).toBe('board_play');
  });
});

// ── UNDO across face-off ─────────────────────────────────────────────────────

describe('face-off: UNDO', () => {
  it('undoes FACEOFF_KEEP back to awaiting_decision', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'UNDO' });
    expect(s.currentMatchState).toBe('face_off');
    expect(faceOffStage(s)).toBe('awaiting_decision');
  });

  it('undoes FACEOFF_FIRST_ANSWER back to awaiting_first_answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'UNDO' });
    expect(faceOffStage(s)).toBe('awaiting_first_answer');
    expect(currentQuestion(s).revealedAnswers).toEqual([]);
  });

  it('undoes FACEOFF_BUZZ_IN back to awaiting_buzz', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'UNDO' });
    expect(faceOffStage(s)).toBe('awaiting_buzz');
    expect(currentQuestion(s).faceOff.firstBuzzTeamId).toBeNull();
  });
});

// ── SKIP_QUESTION resets face-off and picks a fresh question ────────────────

describe('face-off: SKIP_QUESTION during face-off', () => {
  it('drops the current QuestionPlay and creates a fresh one with empty face-off', () => {
    let s = startedTournament();
    const oldQuestionId = currentQuestion(s).questionId;
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 2 });
    s = reducer(s, { type: 'SKIP_QUESTION' });
    const m = s.bracket.round1[0];
    expect(m.questions).toHaveLength(1);
    const q = m.questions[0];
    expect(q.questionId).not.toBe(oldQuestionId);
    expect(q.faceOff.firstBuzzTeamId).toBeNull();
    expect(q.revealedAnswers).toEqual([]);
    expect(faceOffStage(s)).toBe('awaiting_buzz');
  });
});

// ── ADVANCE_MATCH eagerly picks the next match's question ───────────────────

describe('face-off: ADVANCE_MATCH', () => {
  it('seeds the next match with a fresh QuestionPlay and empty face-off', () => {
    // Play out match 1
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 2 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    s = reducer(s, { type: 'ADVANCE_MATCH' });

    expect(s.currentMatchPath).toEqual({ round: 'round1', index: 1 });
    expect(s.currentMatchState).toBe('face_off');
    const m = s.bracket.round1[1];
    expect(m.questions).toHaveLength(1);
    expect(m.questions[0].faceOff.firstBuzzTeamId).toBeNull();
    expect(faceOffStage(s)).toBe('awaiting_buzz');
  });
});

// ── HYDRATE migrates legacy QuestionPlay objects ─────────────────────────────

describe('face-off: HYDRATE migration', () => {
  it('injects an empty faceOff on legacy QuestionPlay records that lack one', () => {
    const empty = initialState();
    const base = startedTournament();
    // Strip the faceOff field from QuestionPlay records as if loading old data.
    const legacy = JSON.parse(JSON.stringify(base)) as TournamentState;
    for (const m of legacy.bracket.round1) {
      for (const q of m.questions) {
        delete (q as { faceOff?: unknown }).faceOff;
      }
    }
    const hydrated = reducer(empty, { type: 'HYDRATE', state: legacy });
    for (const m of hydrated.bracket.round1) {
      for (const q of m.questions) {
        expect(q.faceOff).toBeDefined();
        expect(q.faceOff.firstBuzzTeamId).toBeNull();
      }
    }
  });
});

// ── Steal with click-to-reveal answer ────────────────────────────────────────

describe('steal: click-to-reveal', () => {
  function reachSteal(): TournamentState {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    // Reveal a couple of answers, then strike out
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    return s;
  }

  it('successful steal with answerIndex reveals the answer and awards all points to the stealer', () => {
    let s = reachSteal();
    expect(s.currentMatchState).toBe('steal');
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    s = reducer(s, { type: 'RESOLVE_STEAL', successful: true, answerIndex: 2 });
    const m = s.bracket.round1[0];
    const lastQ = m.questions[m.questions.length - 1];
    expect(lastQ.revealedAnswers).toContain(2);
    const expected =
      def.answers[0].points + def.answers[1].points + def.answers[2].points;
    expect(m.scoreB).toBe(expected);
    expect(m.scoreA).toBe(0);
    expect(s.currentMatchState).toBe('awarded');
  });

  it('successful steal without answerIndex still awards (back-compat)', () => {
    let s = reachSteal();
    s = reducer(s, { type: 'RESOLVE_STEAL', successful: true });
    const m = s.bracket.round1[0];
    expect(m.scoreB).toBeGreaterThan(0);
    expect(s.currentMatchState).toBe('awarded');
  });

  it('failed steal awards score to original team and marks the attempt', () => {
    let s = reachSteal();
    s = reducer(s, { type: 'RESOLVE_STEAL', successful: false });
    const lastQ = currentQuestion(s);
    expect(lastQ.stealAttempted).toBe(true);
    expect(lastQ.stealSuccessful).toBe(false);
    const m = s.bracket.round1[0];
    expect(m.scoreA).toBeGreaterThan(0);
    expect(m.scoreB).toBe(0);
  });
});

// ── Courtesy board reveal after the question ends ───────────────────────────

describe('courtesy reveal after question ends', () => {
  it('AWARD_POINTS_TO_ACTIVE flips all remaining answers but does not change the score', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    expect(q.revealedAnswers.sort()).toEqual([0, 1, 2, 3, 4]);
    // Score is the SUM of answers revealed BEFORE the award (0 + 1), not all 5.
    const expected = def.answers[0].points + def.answers[1].points;
    expect(s.bracket.round1[0].scoreA).toBe(expected);
  });

  it('RESOLVE_STEAL successful flips remaining answers, score includes the steal answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'RESOLVE_STEAL', successful: true, answerIndex: 2 });
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    expect(q.revealedAnswers.sort()).toEqual([0, 1, 2, 3, 4]);
    const expected =
      def.answers[0].points + def.answers[1].points + def.answers[2].points;
    expect(s.bracket.round1[0].scoreB).toBe(expected);
  });

  it('RESOLVE_STEAL failed flips remaining answers, score is original team\'s reveals only', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'RESOLVE_STEAL', successful: false });
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    expect(q.revealedAnswers.sort()).toEqual([0, 1, 2, 3, 4]);
    const expected = def.answers[0].points + def.answers[1].points;
    expect(s.bracket.round1[0].scoreA).toBe(expected);
  });
});

// ── pointsForQuestion regression: face-off reveals contribute to award ──────

describe('face-off: scoring', () => {
  it('awarded points include face-off reveals', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'FACEOFF_BUZZ_IN', teamId: 'a' });
    s = reducer(s, { type: 'FACEOFF_FIRST_ANSWER', answerIndex: 0 }); // reveals top answer
    s = reducer(s, { type: 'FACEOFF_KEEP' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    const q = currentQuestion(s);
    const def = questionDef(q.questionId);
    const expected = def.answers[0].points + def.answers[1].points;
    expect(s.bracket.round1[0].scoreA).toBe(expected);
  });
});
