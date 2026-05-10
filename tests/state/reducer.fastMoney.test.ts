import { describe, it, expect } from 'vitest';
import { initialState } from '../../src/state/initialState';
import { reducer } from '../../src/state/reducer';
import { FAST_MONEY_QUESTION_IDS } from '../../src/content/fastMoneyConfig';

describe('Fast Money threshold — initialState default', () => {
  it('defaults to 200', () => {
    const s = initialState();
    expect(s.fastMoneyThreshold).toBe(200);
  });
});

describe('reducer: SET_FM_THRESHOLD', () => {
  it('updates fastMoneyThreshold with a valid value', () => {
    const s = initialState();
    const next = reducer(s, { type: 'SET_FM_THRESHOLD', value: 150 });
    expect(next.fastMoneyThreshold).toBe(150);
  });

  it('clamps below-min values up to 50', () => {
    const s = initialState();
    const next = reducer(s, { type: 'SET_FM_THRESHOLD', value: 10 });
    expect(next.fastMoneyThreshold).toBe(50);
  });

  it('clamps above-max values down to 400', () => {
    const s = initialState();
    const next = reducer(s, { type: 'SET_FM_THRESHOLD', value: 999 });
    expect(next.fastMoneyThreshold).toBe(400);
  });

  it('is a no-op once both players have submitted all FM answers', () => {
    const s = initialState();
    const lockedState = {
      ...s,
      bracket: {
        ...s.bracket,
        fastMoney: {
          player1: FAST_MONEY_QUESTION_IDS.map(() => ({ text: 'x', points: 0 })),
          player2: FAST_MONEY_QUESTION_IDS.map(() => ({ text: 'x', points: 0 })),
          totalScore: 0,
          won: false,
        },
      },
    };
    const next = reducer(lockedState, { type: 'SET_FM_THRESHOLD', value: 150 });
    expect(next.fastMoneyThreshold).toBe(200);  // unchanged
  });
});

describe('reducer: COMPLETE_FAST_MONEY uses fastMoneyThreshold', () => {
  function fmStateWithScores(p1Pts: number[], p2Pts: number[], threshold: number) {
    const s = initialState();
    return {
      ...s,
      fastMoneyThreshold: threshold,
      bracket: {
        ...s.bracket,
        fastMoney: {
          player1: p1Pts.map(p => ({ text: 'x', points: p })),
          player2: p2Pts.map(p => ({ text: 'x', points: p })),
          totalScore: 0,
          won: false,
        },
      },
    };
  }

  it('won is true when total >= threshold (threshold 150, score 160)', () => {
    const s = fmStateWithScores([10, 20, 30, 20, 10], [10, 20, 30, 20, 10], 150);
    const next = reducer(s, { type: 'COMPLETE_FAST_MONEY' });
    expect(next.bracket.fastMoney!.totalScore).toBe(180);
    expect(next.bracket.fastMoney!.won).toBe(true);
  });

  it('won is false when total < threshold (threshold 250, score 200)', () => {
    const s = fmStateWithScores([20, 20, 20, 20, 20], [20, 20, 20, 20, 20], 250);
    const next = reducer(s, { type: 'COMPLETE_FAST_MONEY' });
    expect(next.bracket.fastMoney!.totalScore).toBe(200);
    expect(next.bracket.fastMoney!.won).toBe(false);
  });
});
