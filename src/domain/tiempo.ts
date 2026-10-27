import type { Tarea } from './types';

/** Duraciones en minutos enteros. Límite: 1000 h. */
export const DURACION_MAXIMA_MIN = 60_000;

/** "45 min", "2 h", "2 h 30 min". Las unidades son iguales en español e inglés. */
export function formatearDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const UNIDAD_HORAS = /^(h|hr|hrs|hora|horas|hour|hours)$/;
const UNIDAD_MINUTOS = /^(m|min|mins|minuto|minutos|minute|minutes)$/;

/**
 * Interpreta una duración escrita a mano. Devuelve minutos, `undefined` si está vacía
 * o `null` si no se entiende.
 * Acepta: "45" (minutos), "1.5" o "1,5" (horas), "1:30", "2h", "90 min", "1h 30m", "1 hora y 20 minutos".
 */
export function parsearDuracion(texto: string): number | undefined | null {
  const limpio = texto.trim().toLowerCase().replace(/,/g, '.');
  if (!limpio) return undefined;

  let minutos: number;
  const reloj = /^(\d+):([0-5]?\d)$/.exec(limpio);
  if (reloj) {
    minutos = Number(reloj[1]) * 60 + Number(reloj[2]);
  } else if (/^\d+$/.test(limpio)) {
    minutos = Number(limpio);
  } else if (/^\d*\.\d+$/.test(limpio)) {
    minutos = Number(limpio) * 60;
  } else {
    // Secuencia de pares número + unidad que debe cubrir todo el texto.
    const texto = limpio.replace(/\b(y|and)\b/g, ' ').trim();
    const par = /\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*/y;
    minutos = 0;
    while (par.lastIndex < texto.length) {
      const encontrado = par.exec(texto);
      if (!encontrado) return null;
      const [, numero, unidad] = encontrado;
      if (UNIDAD_HORAS.test(unidad!)) minutos += Number(numero) * 60;
      else if (UNIDAD_MINUTOS.test(unidad!)) minutos += Number(numero);
      else return null;
    }
  }

  minutos = Math.round(minutos);
  return minutos > 0 && minutos <= DURACION_MAXIMA_MIN ? minutos : null;
}

export interface ResumenTiempo {
  /** Suma de estimados de todas las tareas. */
  estimadoTotal: number;
  /** Suma de estimados de las tareas no hechas: lo que falta. */
  estimadoPendiente: number;
  /** Suma de tiempos reales registrados. */
  realTotal: number;
  /**
   * Desviación (en %) entre real y estimado, solo con tareas que tienen ambos datos.
   * Positiva: se tardó más de lo estimado. `undefined` si no hay datos para comparar.
   */
  desviacion?: number;
}

export function calcularTiempos(tareas: readonly Tarea[]): ResumenTiempo {
  let estimadoTotal = 0;
  let estimadoPendiente = 0;
  let realTotal = 0;
  let estimadoComparable = 0;
  let realComparable = 0;
  for (const tarea of tareas) {
    estimadoTotal += tarea.estimadoMin ?? 0;
    if (tarea.estado !== 'hecha') estimadoPendiente += tarea.estimadoMin ?? 0;
    realTotal += tarea.realMin ?? 0;
    if (tarea.estimadoMin && tarea.realMin) {
      estimadoComparable += tarea.estimadoMin;
      realComparable += tarea.realMin;
    }
  }
  return {
    estimadoTotal,
    estimadoPendiente,
    realTotal,
    ...(estimadoComparable > 0 && {
      desviacion: Math.round(((realComparable - estimadoComparable) / estimadoComparable) * 100),
    }),
  };
}
