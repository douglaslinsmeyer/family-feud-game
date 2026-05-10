import { describe, it, expect } from 'vitest';

// Deliberately failing test — used to verify the CI gate catches broken
// tests before merge. This file should be deleted before the PR is closed.
describe('cicd verification: failing gate', () => {
  it('asserts a falsehood so CI fails', () => {
    expect(2 + 2).toBe(5);
  });
});
