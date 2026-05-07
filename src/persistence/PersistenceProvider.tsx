import { useMemo, type ReactNode } from 'react';
import { PersistenceCtx } from './PersistenceCtx';
import { LocalStorageAdapter } from './localStorageAdapter';
import { DdbAdapter } from './ddbAdapter';
import type { PersistenceAdapter } from './adapter';

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
  return <PersistenceCtx.Provider value={adapter}>{children}</PersistenceCtx.Provider>;
}
