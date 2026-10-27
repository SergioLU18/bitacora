import type { Nota, Proyecto, Tarea } from '../../domain/types';
import type { FiltroNotas, FiltroProyectos, FiltroTareas } from './types';

/** Evaluación en memoria de los filtros. Reutilizable por cualquier implementación local. */

export function cumpleFiltroTareas(tarea: Tarea, filtro: FiltroTareas): boolean {
  if (tarea.eliminadoEn) return false;
  if (filtro.estados && !filtro.estados.includes(tarea.estado)) return false;
  if (filtro.prioridades && !filtro.prioridades.includes(tarea.prioridad)) return false;
  if (filtro.cancha && tarea.cancha !== filtro.cancha) return false;
  if (filtro.proyectoId === null && tarea.proyectoId) return false;
  if (typeof filtro.proyectoId === 'string' && tarea.proyectoId !== filtro.proyectoId) return false;
  if (filtro.deadlineDesde || filtro.deadlineHasta) {
    if (!tarea.deadline) return false;
    if (filtro.deadlineDesde && tarea.deadline < filtro.deadlineDesde) return false;
    if (filtro.deadlineHasta && tarea.deadline >= filtro.deadlineHasta) return false;
  }
  return true;
}

export function cumpleFiltroNotas(nota: Nota, filtro: FiltroNotas): boolean {
  if (nota.eliminadoEn) return false;
  if (filtro.proyectoId && nota.proyectoId !== filtro.proyectoId) return false;
  return true;
}

export function cumpleFiltroProyectos(proyecto: Proyecto, filtro: FiltroProyectos): boolean {
  if (proyecto.eliminadoEn) return false;
  if (filtro.estados && !filtro.estados.includes(proyecto.estado)) return false;
  return true;
}
