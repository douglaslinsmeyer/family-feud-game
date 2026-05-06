import { useContext } from 'react';
import { PersistenceCtx } from './PersistenceCtx';
import type { PersistenceAdapter } from './adapter';

export function usePersistence(): PersistenceAdapter {
  const a = useContext(PersistenceCtx);
  if (!a) throw new Error('PersistenceProvider missing');
  return a;
}
