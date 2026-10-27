import type { ReactNode } from 'react';
import { RepositoryProvider } from '../data/RepositoryContext';
import type { Repositorios } from '../data/repositories/types';
import type { ServicioSync } from '../data/sync/servicio';
import { SincronizacionProvider } from '../data/sync/SincronizacionContext';
import { I18nProvider } from '../i18n/I18nProvider';

export function Providers({
  repositorios,
  sincronizacion,
  children,
}: {
  repositorios: Repositorios;
  sincronizacion: ServicioSync;
  children: ReactNode;
}) {
  return (
    <RepositoryProvider repositorios={repositorios}>
      <SincronizacionProvider servicio={sincronizacion}>
        <I18nProvider>{children}</I18nProvider>
      </SincronizacionProvider>
    </RepositoryProvider>
  );
}
