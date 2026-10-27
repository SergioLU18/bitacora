import { parseISO } from 'date-fns';
import { esperaAlCliente } from './cancha';
import type { DetalleEvento, EventoHistorial, Tarea } from './types';

/** Si un evento revierte al anterior dentro de esta ventana, se consideran un "Deshacer" y se anulan. */
export const MS_DESHACER = 2 * 60_000;

/** Eventos de la misma familia se pueden revertir entre sí (completar ↔ reabrir, etc.). */
export function familia(detalle: DetalleEvento): string {
  switch (detalle.tipo) {
    case 'tarea_completada':
    case 'tarea_reabierta':
      return `estado:${detalle.tareaId}`;
    case 'tarea_eliminada':
    case 'tarea_restaurada':
      return `borrado:${detalle.tareaId}`;
    case 'cancha':
    case 'deadline_tarea':
      return `${detalle.tipo}:${detalle.tareaId}`;
    case 'proyecto_entregado':
    case 'entrega_deshecha':
      return 'entrega';
    default:
      return detalle.tipo;
  }
}

/** `nuevo` revierte a `previo` (p. ej. completar una tarea y pulsar "Deshacer"). */
export function revierte(previo: DetalleEvento, nuevo: DetalleEvento): boolean {
  const mismaTarea = 'tareaId' in previo && 'tareaId' in nuevo && previo.tareaId === nuevo.tareaId;
  switch (nuevo.tipo) {
    case 'tarea_completada':
      return mismaTarea && previo.tipo === 'tarea_reabierta';
    case 'tarea_reabierta':
      return mismaTarea && previo.tipo === 'tarea_completada';
    case 'tarea_restaurada':
      return mismaTarea && previo.tipo === 'tarea_eliminada';
    case 'cancha':
      return mismaTarea && previo.tipo === 'cancha' && previo.a !== nuevo.a;
    case 'deadline_tarea':
      return mismaTarea && previo.tipo === 'deadline_tarea' && previo.de === nuevo.a && previo.a === nuevo.de;
    case 'estado_proyecto':
      return previo.tipo === 'estado_proyecto' && previo.de === nuevo.a && previo.a === nuevo.de;
    case 'entrega_estimada':
      return previo.tipo === 'entrega_estimada' && previo.de === nuevo.a && previo.a === nuevo.de;
    case 'entrega_deshecha':
      return previo.tipo === 'proyecto_entregado';
    default:
      return false;
  }
}

/** Ordena del más reciente al más antiguo. En un mismo instante, la creación del proyecto va al final. */
export function ordenarEventos(eventos: readonly EventoHistorial[]): EventoHistorial[] {
  const esCreacion = (e: EventoHistorial) => (e.detalle.tipo === 'proyecto_creado' ? 1 : 0);
  return [...eventos].sort((a, b) =>
    a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : esCreacion(a) - esCreacion(b),
  );
}

const MS_DIA = 86_400_000;

/**
 * Días naturales en los que al menos una tarea del proyecto estuvo en la cancha del cliente,
 * hasta `hasta` (la entrega o ahora). Se reconstruye con el historial; las tareas que ya
 * esperaban antes de que existiera el historial cuentan desde su `esperandoDesde`.
 */
export function diasEsperandoCliente(eventos: readonly EventoHistorial[], tareas: readonly Tarea[], hasta: Date): number {
  const fin = hasta.getTime();
  const abiertos = new Map<string, number>();
  const tramos: Array<[number, number]> = [];
  const abrir = (id: string, ms: number) => {
    if (!abiertos.has(id)) abiertos.set(id, ms);
  };
  const cerrar = (id: string, ms: number) => {
    const inicio = abiertos.get(id);
    if (inicio === undefined) return;
    tramos.push([inicio, ms]);
    abiertos.delete(id);
  };

  for (const { detalle: d, createdAt } of ordenarEventos(eventos).reverse()) {
    const ms = parseISO(createdAt).getTime();
    if (d.tipo === 'tarea_creada' || d.tipo === 'tarea_restaurada' || d.tipo === 'cancha') {
      const cancha = d.tipo === 'cancha' ? d.a : d.cancha;
      if (cancha === 'cliente') abrir(d.tareaId, ms);
      else cerrar(d.tareaId, ms);
    } else if (d.tipo === 'tarea_completada' || d.tipo === 'tarea_eliminada') {
      cerrar(d.tareaId, ms);
    }
  }
  for (const tarea of tareas) {
    if (esperaAlCliente(tarea) && tarea.esperandoDesde) abrir(tarea.id, parseISO(tarea.esperandoDesde).getTime());
  }
  for (const inicio of abiertos.values()) tramos.push([inicio, fin]);

  // Unión de tramos: dos tareas esperando a la vez cuentan una sola vez.
  let total = 0;
  let actual: [number, number] | undefined;
  for (const [a, b] of tramos.map(([a, b]): [number, number] => [a, Math.min(b, fin)]).sort((x, y) => x[0] - y[0])) {
    if (b <= a) continue;
    if (actual && a <= actual[1]) actual[1] = Math.max(actual[1], b);
    else {
      if (actual) total += actual[1] - actual[0];
      actual = [a, b];
    }
  }
  if (actual) total += actual[1] - actual[0];
  return total / MS_DIA;
}
