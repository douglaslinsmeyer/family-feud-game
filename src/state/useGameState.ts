import { useContext } from 'react';
import { GameStateCtx } from './GameStateCtx';

export function useGameState() {
  const v = useContext(GameStateCtx);
  if (!v) throw new Error('GameStateProvider missing');
  return v;
}
