import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../../src/persistence/localStorageAdapter';
import { initialState } from '../../src/state/initialState';

// Mock localStorage since jsdom's localStorage may not be fully functional
// in the vitest/jsdom setup being used (opaque origin mode).
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
};

vi.stubGlobal('localStorage', mockLocalStorage);

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('saves and loads state by tournamentId', async () => {
    const adapter = new LocalStorageAdapter();
    const s = initialState();
    await adapter.save(s);
    const loaded = await adapter.load(s.tournamentId);
    expect(loaded).toEqual(s);
  });

  it('returns null for unknown tournamentId', async () => {
    const adapter = new LocalStorageAdapter();
    expect(await adapter.load('nonexistent')).toBeNull();
  });

  it('persists state as JSON under the expected localStorage key', async () => {
    const adapter = new LocalStorageAdapter();
    const s = initialState();
    await adapter.save(s);
    const raw = localStorage.getItem(`family-feud:state:${s.tournamentId}`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(s);
  });

  it('overwrites existing state on successive saves', async () => {
    const adapter = new LocalStorageAdapter();
    const s = initialState();
    await adapter.save(s);
    const updated = { ...s, status: 'done' as const, updatedAt: Date.now() + 1000 };
    await adapter.save(updated);
    const loaded = await adapter.load(s.tournamentId);
    expect(loaded?.status).toBe('done');
  });
});
