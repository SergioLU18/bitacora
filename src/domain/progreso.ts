import type { Tarea } from './types';

export interface Progreso {
  total: number;
  hechas: number;
  /** Entero 0–100. Un proyecto sin tareas tiene 0 %. */
  porcentaje: number;
}

export function calcularProgreso(tareas: readonly Tarea[]): Progreso {
  const total = tareas.length;
  const hechas = tareas.filter((t) => t.estado === 'hecha').length;
  return { total, hechas, porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100) };
}

/** Avance de la checklist de una tarea; `undefined` si no tiene. */
export function progresoChecklist(tarea: Tarea): { hechos: number; total: number } | undefined {
  if (!tarea.checklist?.length) return undefined;
  return { hechos: tarea.checklist.filter((i) => i.hecho).length, total: tarea.checklist.length };
}

/** Progreso de cada proyecto a partir de una lista de tareas (una sola pasada). */
export function calcularProgresoPorProyecto(tareas: readonly Tarea[]): Map<string, Progreso> {
  const agrupadas = new Map<string, Tarea[]>();
  for (const tarea of tareas) {
    if (!tarea.proyectoId) continue;
    const lista = agrupadas.get(tarea.proyectoId) ?? [];
    lista.push(tarea);
    agrupadas.set(tarea.proyectoId, lista);
  }
  return new Map([...agrupadas].map(([id, lista]) => [id, calcularProgreso(lista)]));
}
