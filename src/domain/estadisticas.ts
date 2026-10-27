import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { deadlineTodoElDia } from './deadline';
import { diasEsperandoCliente } from './historial';
import { calcularTiempos, type ResumenTiempo } from './tiempo';
import type { EventoHistorial, FechaISO, Proyecto, Tarea } from './types';

/**
 * Estadísticas de entrega por proyecto y en conjunto, para aprender a estimar:
 * el "factor" es cuánto tardan de verdad los proyectos respecto a su primera estimación.
 */

export interface EstadisticaProyecto {
  proyecto: Proyecto;
  inicio: FechaISO;
  entregado: boolean;
  /** Días de inicio a la primera estimación de entrega. */
  diasEstimados?: number;
  /** Días de inicio a la entrega, o hasta hoy si sigue en curso. */
  diasTranscurridos: number;
  /** Solo entregados con estimación: real / estimado. 1.3 = tardó un 30 % más. */
  factor?: number;
  /** Entregado en la fecha vigente o antes. */
  aTiempo?: boolean;
  /** En curso: días hasta la entrega vigente (negativo = atrasado). */
  diasRestantes?: number;
  /** Veces que se movió la fecha de entrega. */
  reestimaciones: number;
  diasEsperaCliente: number;
  cambios: number;
  tiempo: ResumenTiempo;
}

export function inicioDe(proyecto: Proyecto): FechaISO {
  return proyecto.inicio ?? proyecto.createdAt;
}

/** Días naturales entre dos fechas, con mínimo de 1 (un proyecto de un día dura un día). */
function dias(desde: FechaISO, hasta: FechaISO | Date): number {
  return Math.max(1, differenceInCalendarDays(typeof hasta === 'string' ? parseISO(hasta) : hasta, parseISO(desde)));
}

export function calcularEstadisticaProyecto(
  proyecto: Proyecto,
  tareas: readonly Tarea[],
  eventos: readonly EventoHistorial[],
  ahora: Date = new Date(),
): EstadisticaProyecto {
  const inicio = inicioDe(proyecto);
  const entregado = !!proyecto.entregadoEn;
  const fin = proyecto.entregadoEn ? parseISO(proyecto.entregadoEn) : ahora;
  const estimacion = proyecto.entregaEstimadaInicial ?? proyecto.entregaEstimada;
  const diasEstimados = estimacion ? dias(inicio, estimacion) : undefined;
  const diasTranscurridos = dias(inicio, fin);

  return {
    proyecto,
    inicio,
    entregado,
    ...(diasEstimados !== undefined && { diasEstimados }),
    diasTranscurridos,
    ...(entregado && diasEstimados !== undefined && { factor: redondear(diasTranscurridos / diasEstimados, 2) }),
    ...(entregado && proyecto.entregaEstimada && { aTiempo: proyecto.entregadoEn! <= proyecto.entregaEstimada }),
    ...(!entregado &&
      proyecto.entregaEstimada && { diasRestantes: differenceInCalendarDays(parseISO(proyecto.entregaEstimada), ahora) }),
    reestimaciones: eventos.filter((e) => e.detalle.tipo === 'entrega_estimada' && e.detalle.de).length,
    diasEsperaCliente: redondear(diasEsperandoCliente(eventos, tareas, fin), 1),
    cambios: eventos.filter((e) => e.detalle.tipo === 'cambio').length,
    tiempo: calcularTiempos(tareas),
  };
}

export interface ResumenEstadisticas {
  entregados: number;
  /** Entregados con estimación: la base del factor. */
  conEstimacion: number;
  /** Mediana de los factores (robusta ante un proyecto atípico). */
  factor?: number;
  aTiempoPorcentaje?: number;
  diasPromedio?: number;
  esperaPromedio?: number;
  cambiosPromedio?: number;
  /** % de desviación del tiempo real de las tareas frente al estimado, en todos los proyectos. */
  desviacionTareas?: number;
}

export function resumirEstadisticas(
  estadisticas: readonly EstadisticaProyecto[],
  tareas: readonly Tarea[],
): ResumenEstadisticas {
  const entregados = estadisticas.filter((e) => e.entregado);
  const factores = entregados.flatMap((e) => (e.factor !== undefined ? [e.factor] : []));
  const conFecha = entregados.filter((e) => e.aTiempo !== undefined);
  const promedio = (valores: number[]) =>
    valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length, 1) : undefined;
  const { desviacion } = calcularTiempos(tareas);

  return {
    entregados: entregados.length,
    conEstimacion: factores.length,
    ...(factores.length > 0 && { factor: mediana(factores) }),
    ...(conFecha.length > 0 && {
      aTiempoPorcentaje: Math.round((conFecha.filter((e) => e.aTiempo).length / conFecha.length) * 100),
    }),
    ...(entregados.length > 0 && {
      diasPromedio: promedio(entregados.map((e) => e.diasTranscurridos)),
      esperaPromedio: promedio(entregados.map((e) => e.diasEsperaCliente)),
      cambiosPromedio: promedio(entregados.map((e) => e.cambios)),
    }),
    ...(desviacion !== undefined && { desviacionTareas: desviacion }),
  };
}

/** Entrega probable si este proyecto se comporta como los anteriores (`factor` de la mediana). */
export function entregaProbable(inicio: FechaISO, entregaEstimada: FechaISO, factor: number): FechaISO {
  const estimados = dias(inicio, entregaEstimada);
  return deadlineTodoElDia(addDays(parseISO(inicio), Math.ceil(estimados * factor)));
}

/**
 * Entrega probable de un proyecto en curso. El factor se mide contra la primera estimación,
 * así que se aplica sobre ella (aplicarlo a una fecha ya re-estimada contaría el retraso dos veces).
 * `undefined` si ya se entregó, no hay estimación o el factor es prácticamente 1.
 */
export function entregaProbableDe(proyecto: Proyecto, factor: number | undefined): FechaISO | undefined {
  const estimacion = proyecto.entregaEstimadaInicial ?? proyecto.entregaEstimada;
  if (proyecto.entregadoEn || !estimacion || !factor || Math.abs(factor - 1) < 0.05) return undefined;
  return entregaProbable(inicioDe(proyecto), estimacion, factor);
}

function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return redondear(orden.length % 2 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2, 2);
}

function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}
