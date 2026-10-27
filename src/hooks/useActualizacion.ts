import { useSyncExternalStore } from 'react';
import { obtenerEstadoActualizacion, observarActualizacion, type EstadoActualizacion } from '../lib/actualizaciones';

/** Estado de las actualizaciones en vivo de la app de iOS. */
export function useActualizacion(): EstadoActualizacion {
  return useSyncExternalStore(observarActualizacion, obtenerEstadoActualizacion);
}
