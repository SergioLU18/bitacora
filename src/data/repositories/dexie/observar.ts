import { liveQuery } from 'dexie';
import type { AlCambiar, AlError, Cancelar } from '../types';

/** Adapta `liveQuery` de Dexie a la forma neutral `observar(cb) → cancelar` de los repositorios. */
export function observarConsulta<T>(
  consulta: () => Promise<T>,
  alCambiar: AlCambiar<T>,
  alError: AlError = (error) => console.error(error),
): Cancelar {
  const suscripcion = liveQuery(consulta).subscribe({ next: alCambiar, error: alError });
  return () => suscripcion.unsubscribe();
}
