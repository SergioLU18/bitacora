import type { Nota, Prioridad, Tarea } from './types';

const PESO_PRIORIDAD: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

/**
 * Orden por defecto: deadline más cercano primero (sin deadline al final),
 * luego prioridad (alta primero) y por último fecha de creación.
 * Los ISO en UTC se ordenan correctamente como strings.
 */
export function compararTareas(a: Tarea, b: Tarea): number {
  if (a.deadline !== b.deadline) {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline < b.deadline ? -1 : 1;
  }
  const prioridad = PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
  if (prioridad !== 0) return prioridad;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function ordenarTareas(tareas: readonly Tarea[]): Tarea[] {
  return [...tareas].sort(compararTareas);
}

/** Notas: fijadas primero y luego la editada más recientemente. */
export function compararNotas(a: Nota, b: Nota): number {
  if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
  return a.updatedAt > b.updatedAt ? -1 : a.updatedAt < b.updatedAt ? 1 : 0;
}

export function ordenarNotas(notas: readonly Nota[]): Nota[] {
  return [...notas].sort(compararNotas);
}
