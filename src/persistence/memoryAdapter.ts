import type { PersistenceAdapter } from './adapter';
import type { TournamentState } from '../state/types';

export class MemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, TournamentState>();

  async load(tournamentId: string): Promise<TournamentState | null> {
    return this.store.get(tournamentId) ?? null;
  }

  async save(state: TournamentState): Promise<void> {
    this.store.set(state.tournamentId, JSON.parse(JSON.stringify(state)));
  }
}
