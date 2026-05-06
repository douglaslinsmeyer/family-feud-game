import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PersistenceAdapter } from './adapter';
import { LocalStorageAdapter } from './localStorageAdapter';
import { DdbAdapter } from './ddbAdapter';

const Ctx = createContext<PersistenceAdapter | null>(null);

export function PersistenceProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo<PersistenceAdapter>(() => {
    if (import.meta.env.VITE_PERSISTENCE === 'ddb') {
      return new DdbAdapter({
        region: import.meta.env.VITE_AWS_REGION!,
        identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID!,
        tableName: import.meta.env.VITE_DDB_TABLE_NAME!,
      });
    }
    return new LocalStorageAdapter();
  }, []);
  return <Ctx.Provider value={adapter}>{children}</Ctx.Provider>;
}

export function usePersistence(): PersistenceAdapter {
  const a = useContext(Ctx);
  if (!a) throw new Error('PersistenceProvider missing');
  return a;
}
