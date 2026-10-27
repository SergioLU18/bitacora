import { addDays, differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type { Tarea } from './types';

/**
 * "En la cancha de quién": una tarea en la cancha del cliente espera algo de él
 * (respuesta, material, aprobación). `seguimiento` es el día en que toca preguntarle.
 */

export function esperaAlCliente(tarea: Tarea): boolean {
  return tarea.cancha === 'cliente' && tarea.estado !== 'hecha';
}

/** Días naturales que lleva en la cancha del cliente (0 = desde hoy). */
export function diasEsperando(tarea: Tarea, ahora: Date = new Date()): number | undefined {
  if (!esperaAlCliente(tarea) || !tarea.esperandoDesde) return undefined;
  return Math.max(0, differenceInCalendarDays(ahora, parseISO(tarea.esperandoDesde)));
}

/** Toca dar seguimiento: su día de seguimiento es hoy o ya pasó. */
export function tocaSeguimiento(tarea: Tarea, ahora: Date = new Date()): boolean {
  if (!esperaAlCliente(tarea) || !tarea.seguimiento) return false;
  return parseISO(tarea.seguimiento) < addDays(startOfDay(ahora), 1);
}

/**
 * Orden de la lista de espera: primero lo que toca seguir (el seguimiento más antiguo arriba),
 * luego lo que lleva más tiempo esperando.
 */
export function compararEsperando(a: Tarea, b: Tarea): number {
  if (a.seguimiento !== b.seguimiento) {
    if (!a.seguimiento) return 1;
    if (!b.seguimiento) return -1;
    return a.seguimiento < b.seguimiento ? -1 : 1;
  }
  const desdeA = a.esperandoDesde ?? a.createdAt;
  const desdeB = b.esperandoDesde ?? b.createdAt;
  return desdeA < desdeB ? -1 : desdeA > desdeB ? 1 : 0;
}
