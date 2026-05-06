import { useContext } from 'react';
import { AudioCtx } from './audioTypes';

export function useSfx() {
  const v = useContext(AudioCtx);
  if (!v) throw new Error('useSfx must be used within AudioProvider');
  return v;
}
