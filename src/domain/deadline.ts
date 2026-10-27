import { addDays, differenceInCalendarDays, isBefore, parseISO, startOfDay } from 'date-fns';
import type { FechaISO, Tarea } from './types';

/**
 * Clasificación visual de un deadline respecto a "ahora":
 * - vencida: la fecha y hora ya pasaron
 * - hoy / manana: vence más tarde hoy o mañana
 * - semana: vence dentro de los próximos 7 días (misma ventana que la vista "Próximos")
 * - futuro: más adelante
 */
export type EstadoDeadline = 'vencida' | 'hoy' | 'manana' | 'semana' | 'futuro';

export const DIAS_PROXIMOS = 7;

export function clasificarDeadline(deadline: FechaISO, ahora: Date = new Date()): EstadoDeadline {
  const fecha = parseISO(deadline);
  if (isBefore(fecha, ahora)) return 'vencida';
  const dias = differenceInCalendarDays(fecha, ahora);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  if (dias <= DIAS_PROXIMOS) return 'semana';
  return 'futuro';
}

/**
 * Un deadline sin hora explícita ("todo el día") se guarda a las 23:59 locales:
 * así vence al terminar el día y sigue siendo un instante ISO comparable.
 */
export function deadlineTodoElDia(dia: Date): FechaISO {
  const fecha = new Date(dia);
  fecha.setHours(23, 59, 0, 0);
  return fecha.toISOString();
}

export function esTodoElDia(deadline: FechaISO): boolean {
  const fecha = parseISO(deadline);
  return fecha.getHours() === 23 && fecha.getMinutes() === 59;
}

/** Una tarea está vencida si no está hecha y su deadline ya pasó. */
export function estaVencida(tarea: Tarea, ahora: Date = new Date()): boolean {
  return tarea.estado !== 'hecha' && !!tarea.deadline && isBefore(parseISO(tarea.deadline), ahora);
}

/** Rango [inicio, fin) del día de `fecha` en hora local, como ISO. */
export function rangoDelDia(fecha: Date = new Date()): { desde: FechaISO; hasta: FechaISO } {
  const inicio = startOfDay(fecha);
  return { desde: inicio.toISOString(), hasta: addDays(inicio, 1).toISOString() };
}

/** Rango [mañana 00:00, mañana + 7 días) para la vista "Próximos". */
export function rangoProximos(fecha: Date = new Date()): { desde: FechaISO; hasta: FechaISO } {
  const manana = addDays(startOfDay(fecha), 1);
  return { desde: manana.toISOString(), hasta: addDays(manana, DIAS_PROXIMOS).toISOString() };
}
