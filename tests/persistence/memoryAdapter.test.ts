import { describe, it, expect } from 'vitest';
import { MemoryAdapter } from '../../src/persistence/memoryAdapter';
import { initialState } from '../../src/state/initialState';

describe('MemoryAdapter', () => {
  it('saves and loads state by tournamentId', async () => {
    const a = new MemoryAdapter();
    const s = initialState();
    await a.save(s);
    const loaded = await a.load(s.tournamentId);
    expect(loaded).toEqual(s);
  });

  it('returns null for unknown tournamentId', async () => {
    const a = new MemoryAdapter();
    expect(await a.load('nonexistent')).toBeNull();
  });
});
