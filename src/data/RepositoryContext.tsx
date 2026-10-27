import { createContext, useContext, type ReactNode } from 'react';
import type { Repositorios } from './repositories/types';

const RepositoryContext = createContext<Repositorios | null>(null);

export function RepositoryProvider({ repositorios, children }: { repositorios: Repositorios; children: ReactNode }) {
  return <RepositoryContext.Provider value={repositorios}>{children}</RepositoryContext.Provider>;
}

export function useRepositorios(): Repositorios {
  const repos = useContext(RepositoryContext);
  if (!repos) throw new Error('useRepositorios debe usarse dentro de <RepositoryProvider>');
  return repos;
}
