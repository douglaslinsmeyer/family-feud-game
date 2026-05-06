import { useReducer, useEffect, type ReactNode } from 'react';
import { reducer } from './reducer';
import { initialState } from './initialState';
import { usePersistence } from '../persistence/usePersistence';
import { GameStateCtx } from './GameStateCtx';

const STORAGE_KEY = 'family-feud:tournamentId';

export function GameStateProvider({ children, isWriter }: { children: ReactNode; isWriter: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const persistence = usePersistence();

  // On mount: try to resume an in-progress tournament.
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      persistence.load(id).then(loaded => {
        if (loaded) {
          // For MVP: bootstrap from teams; full HYDRATE comes in Plan B.
          // To at least restore some state, set teams.
          dispatch({ type: 'SET_TEAMS', teams: loaded.teams });
        }
      }).catch(() => { /* swallow */ });
    } else {
      localStorage.setItem(STORAGE_KEY, state.tournamentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Writer side effect: persist after every dispatch.
  useEffect(() => {
    if (isWriter) {
      persistence.save(state).catch(err => console.error('persistence save failed', err));
    }
  }, [state, isWriter, persistence]);

  return <GameStateCtx.Provider value={{ state, dispatch }}>{children}</GameStateCtx.Provider>;
}
