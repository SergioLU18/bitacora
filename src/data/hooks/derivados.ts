import { useMemo } from 'react';
import { esperaAlCliente, tocaSeguimiento } from '../../domain/cancha';
import {
  calcularEstadisticaProyecto,
  resumirEstadisticas,
  type EstadisticaProyecto,
  type ResumenEstadisticas,
} from '../../domain/estadisticas';
import { estaVencida, rangoDelDia, rangoProximos } from '../../domain/deadline';
import type { Proyecto } from '../../domain/types';
import { useHistorial, useProyectos, useTareas } from './index';

/** Proyectos indexados por id (incluye archivados, para mostrar el nombre en tareas antiguas). */
export function useMapaProyectos(): ReadonlyMap<string, Proyecto> {
  const proyectos = useProyectos();
  return useMemo(() => new Map((proyectos.datos ?? []).map((p) => [p.id, p])), [proyectos.datos]);
}

export interface Conteos {
  vencidas: number;
  hoy: number;
  proximos: number;
  pendientes: number;
  /** Pendientes en la cancha del cliente. */
  esperandoCliente: number;
  /** De esas, a cuántas toca darles seguimiento hoy (o ya se pasó el día). */
  seguimientos: number;
  pendientesPorProyecto: ReadonlyMap<string, number>;
}

/** Conteos para la navegación, calculados con una sola suscripción a las tareas pendientes. */
export function useConteos(ahora: Date): Conteos | undefined {
  const pendientes = useTareas({ estados: ['pendiente', 'en_curso'] });
  const dia = rangoDelDia(ahora);
  const proximos = rangoProximos(ahora);

  return useMemo(() => {
    if (!pendientes.datos) return undefined;
    const porProyecto = new Map<string, number>();
    let vencidas = 0;
    let hoy = 0;
    let enProximos = 0;
    let esperandoCliente = 0;
    let seguimientos = 0;
    for (const tarea of pendientes.datos) {
      if (tarea.proyectoId) porProyecto.set(tarea.proyectoId, (porProyecto.get(tarea.proyectoId) ?? 0) + 1);
      if (esperaAlCliente(tarea)) esperandoCliente++;
      if (tocaSeguimiento(tarea, ahora)) seguimientos++;
      if (!tarea.deadline) continue;
      if (estaVencida(tarea, ahora)) vencidas++;
      else if (tarea.deadline < dia.hasta) hoy++;
      else if (tarea.deadline >= proximos.desde && tarea.deadline < proximos.hasta) enProximos++;
    }
    return {
      vencidas,
      hoy,
      proximos: enProximos,
      pendientes: pendientes.datos.length,
      esperandoCliente,
      seguimientos,
      pendientesPorProyecto: porProyecto,
    };
    // `ahora` cambia cada minuto; los rangos solo al cambiar de día.
  }, [pendientes.datos, ahora, dia.hasta, proximos.desde, proximos.hasta]);
}

export interface Estadisticas {
  porProyecto: ReadonlyMap<string, EstadisticaProyecto>;
  resumen: ResumenEstadisticas;
}

/** Estadísticas de entrega de todos los proyectos, incluidos los archivados. */
export function useEstadisticas(ahora: Date): Estadisticas | undefined {
  const proyectos = useProyectos();
  const tareas = useTareas();
  const historial = useHistorial();
  const dia = rangoDelDia(ahora).desde;

  return useMemo(() => {
    if (!proyectos.datos || !tareas.datos || !historial.datos) return undefined;
    const tareasPorProyecto = agrupar(tareas.datos, (t) => t.proyectoId);
    const eventosPorProyecto = agrupar(historial.datos, (e) => e.proyectoId);
    const porProyecto = new Map(
      proyectos.datos.map((p) => [
        p.id,
        calcularEstadisticaProyecto(p, tareasPorProyecto.get(p.id) ?? [], eventosPorProyecto.get(p.id) ?? [], new Date(dia)),
      ]),
    );
    return { porProyecto, resumen: resumirEstadisticas([...porProyecto.values()], tareas.datos) };
    // Se recalcula al cambiar los datos o el día, no cada minuto.
  }, [proyectos.datos, tareas.datos, historial.datos, dia]);
}

function agrupar<T>(lista: readonly T[], clave: (x: T) => string | undefined): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const x of lista) {
    const k = clave(x);
    if (k) mapa.set(k, [...(mapa.get(k) ?? []), x]);
  }
  return mapa;
}
