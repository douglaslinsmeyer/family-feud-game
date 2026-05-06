import { createContext } from 'react';
import type { PersistenceAdapter } from './adapter';

export const PersistenceCtx = createContext<PersistenceAdapter | null>(null);
