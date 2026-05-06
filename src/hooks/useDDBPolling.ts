import { useEffect, useState } from 'react';
import type { TournamentState } from '../state/types';
import { usePersistence } from '../persistence/PersistenceProvider';

export function useTournamentPolling(tournamentId: string, intervalMs = 750) {
  const persistence = usePersistence();
  const [state, setState] = useState<TournamentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const loaded = await persistence.load(tournamentId);
        if (!cancelled && loaded) setState(loaded);
      } catch (e) { /* swallow; retry next tick */ }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [tournamentId, intervalMs, persistence]);

  return state;
}
