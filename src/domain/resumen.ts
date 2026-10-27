import { format } from 'date-fns';
import { compararEsperando, esperaAlCliente } from './cancha';
import { clasificarDeadline } from './deadline';
import { ordenarTareas } from './orden';
import type { EstadoTarea, FechaISO, Prioridad, Proyecto, Tarea } from './types';

/**
 * Resumen serializable de las tareas pendientes. Pensado para:
 * - el widget de iOS (WidgetKit lee este JSON desde un App Group)
 * - programar notificaciones locales de deadlines
 * Es JSON plano y versionado: si cambia la forma, se incrementa `version`.
 */
export interface ResumenPendientes {
  version: 2;
  generadoEn: FechaISO;
  /** Día local al que corresponde el resumen, "yyyy-MM-dd". */
  dia: string;
  conteos: {
    vencidas: number;
    hoy: number;
    proximos7Dias: number;
    sinDeadline: number;
    /** Pendientes en la cancha del cliente, tengan o no día de seguimiento. */
    seguimiento: number;
  };
  vencidas: TareaResumida[];
  hoy: TareaResumida[];
  proximas: TareaResumida[];
  /**
   * Lo que espera al cliente, en el orden de la vista Seguimiento (primero lo que toca preguntar).
   * Va aparte de las listas por deadline: una tarea puede estar en ambas y el widget la muestra una vez.
   */
  seguimiento: TareaResumida[];
}

export interface TareaResumida {
  id: string;
  titulo: string;
  deadline?: FechaISO;
  prioridad: Prioridad;
  estado: EstadoTarea;
  estimadoMin?: number;
  proyecto?: { id: string; nombre: string; color: string };
  /** Solo en la lista `seguimiento`: desde cuándo espera y el día en que toca preguntar. */
  esperandoDesde?: FechaISO;
  seguimiento?: FechaISO;
}

export interface OpcionesResumen {
  ahora?: Date;
  /** Máximo de tareas por lista (los conteos siempre son totales). */
  limitePorLista?: number;
}

export function generarResumenPendientes(
  tareas: readonly Tarea[],
  proyectos: readonly Proyecto[],
  { ahora = new Date(), limitePorLista = 20 }: OpcionesResumen = {},
): ResumenPendientes {
  const proyectosPorId = new Map(proyectos.map((p) => [p.id, p]));
  const pendientes = ordenarTareas(tareas.filter((t) => t.estado !== 'hecha' && !t.eliminadoEn));

  const vencidas: Tarea[] = [];
  const hoy: Tarea[] = [];
  const proximas: Tarea[] = [];
  const seguimiento = pendientes.filter(esperaAlCliente).sort(compararEsperando);
  let sinDeadline = 0;

  for (const tarea of pendientes) {
    if (!tarea.deadline) {
      sinDeadline++;
      continue;
    }
    const clase = clasificarDeadline(tarea.deadline, ahora);
    if (clase === 'vencida') vencidas.push(tarea);
    else if (clase === 'hoy') hoy.push(tarea);
    else if (clase === 'manana' || clase === 'semana') proximas.push(tarea);
  }

  const resumir = (tarea: Tarea): TareaResumida => {
    const proyecto = tarea.proyectoId ? proyectosPorId.get(tarea.proyectoId) : undefined;
    return {
      id: tarea.id,
      titulo: tarea.titulo,
      ...(tarea.deadline && { deadline: tarea.deadline }),
      prioridad: tarea.prioridad,
      estado: tarea.estado,
      ...(tarea.estimadoMin && { estimadoMin: tarea.estimadoMin }),
      ...(proyecto && { proyecto: { id: proyecto.id, nombre: proyecto.nombre, color: proyecto.color } }),
    };
  };
  const resumirEspera = (tarea: Tarea): TareaResumida => ({
    ...resumir(tarea),
    ...(tarea.esperandoDesde && { esperandoDesde: tarea.esperandoDesde }),
    ...(tarea.seguimiento && { seguimiento: tarea.seguimiento }),
  });

  return {
    version: 2,
    generadoEn: ahora.toISOString(),
    dia: format(ahora, 'yyyy-MM-dd'),
    conteos: {
      vencidas: vencidas.length,
      hoy: hoy.length,
      proximos7Dias: proximas.length,
      sinDeadline,
      seguimiento: seguimiento.length,
    },
    vencidas: vencidas.slice(0, limitePorLista).map(resumir),
    hoy: hoy.slice(0, limitePorLista).map(resumir),
    proximas: proximas.slice(0, limitePorLista).map(resumir),
    seguimiento: seguimiento.slice(0, limitePorLista).map(resumirEspera),
  };
}
