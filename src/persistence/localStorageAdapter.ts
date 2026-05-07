import type { PersistenceAdapter } from './adapter';
import type { TournamentState } from '../state/types';

const KEY_PREFIX = 'family-feud:state:';

export class LocalStorageAdapter implements PersistenceAdapter {
  async load(tournamentId: string): Promise<TournamentState | null> {
    const raw = localStorage.getItem(KEY_PREFIX + tournamentId);
    return raw ? (JSON.parse(raw) as TournamentState) : null;
  }
  async save(state: TournamentState): Promise<void> {
    localStorage.setItem(KEY_PREFIX + state.tournamentId, JSON.stringify(state));
  }
}
