import { createContext } from 'react';
import type { TournamentState, Action } from './types';

export type GameStateCtxType = {
  state: TournamentState;
  dispatch: (action: Action) => void;
};

export const GameStateCtx = createContext<GameStateCtxType | null>(null);
