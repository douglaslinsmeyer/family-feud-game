import type { TournamentState } from '../state/types';

export interface PersistenceAdapter {
  load(tournamentId: string): Promise<TournamentState | null>;
  save(state: TournamentState): Promise<void>;
}
