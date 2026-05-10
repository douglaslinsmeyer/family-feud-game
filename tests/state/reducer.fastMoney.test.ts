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
