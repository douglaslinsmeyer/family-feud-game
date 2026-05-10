import { describe, it, expect } from 'vitest';
import { initialState } from '../../src/state/initialState';

describe('Fast Money threshold — initialState default', () => {
  it('defaults to 200', () => {
    const s = initialState();
    expect(s.fastMoneyThreshold).toBe(200);
  });
});
