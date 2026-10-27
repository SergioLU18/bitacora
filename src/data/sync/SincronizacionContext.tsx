import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { ServicioSync } from './servicio';
import type { EstadoSync } from './tipos';

const SincronizacionContext = createContext<ServicioSync | null>(null);

export function SincronizacionProvider({ servicio, children }: { servicio: ServicioSync; children: ReactNode }) {
  return <SincronizacionContext.Provider value={servicio}>{children}</SincronizacionContext.Provider>;
}

/** Estado de la cuenta y la sincronización, más sus acciones. */
export function useSincronizacion(): { estado: EstadoSync; servicio: ServicioSync } {
  const servicio = useContext(SincronizacionContext);
  if (!servicio) throw new Error('useSincronizacion debe usarse dentro de <SincronizacionProvider>');
  const estado = useSyncExternalStore(servicio.observar, servicio.obtenerEstado);
  return { estado, servicio };
}
