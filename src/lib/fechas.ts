import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameYear,
  parse,
  parseISO,
  startOfDay,
  type Locale,
} from 'date-fns';
import { deadlineTodoElDia, esTodoElDia } from '../domain/deadline';
import type { FechaISO } from '../domain/types';
import type { Mensajes } from '../i18n/es';

export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1);
}

/** Nombre relativo de un día: "Hoy", "Mañana", "Ayer", "Jue 15", "15 oct" o "15 oct 2027". */
export function nombreDia(fecha: Date, ahora: Date, t: Mensajes, locale: Locale): string {
  if (isSameDay(fecha, ahora)) return t.fechas.hoy;
  if (isSameDay(fecha, addDays(ahora, 1))) return t.fechas.manana;
  if (isSameDay(fecha, addDays(ahora, -1))) return t.fechas.ayer;
  const dias = Math.abs(differenceInCalendarDays(fecha, ahora));
  const patron =
    dias <= 6 ? t.fechas.formatoDiaSemana : isSameYear(fecha, ahora) ? t.fechas.formatoDiaMes : t.fechas.formatoCompleto;
  return capitalizar(format(fecha, patron, { locale }));
}

/** Texto corto de un deadline: "Hoy, 18:00", "Mañana", "Jue 15, 9:30". */
export function textoDeadline(deadline: FechaISO, ahora: Date, t: Mensajes, locale: Locale): string {
  const fecha = parseISO(deadline);
  const dia = nombreDia(fecha, ahora, t, locale);
  return esTodoElDia(deadline) ? dia : `${dia}, ${format(fecha, 'p', { locale })}`;
}

/** Encabezado largo: "Domingo, 11 de octubre". */
export function textoEncabezado(fecha: Date, t: Mensajes, locale: Locale): string {
  return capitalizar(format(fecha, t.fechas.formatoEncabezado, { locale }));
}

// --- Conversión entre deadline ISO y los <input type="date|time"> ------------

export interface ValorFechaHora {
  /** "yyyy-MM-dd" o "" */
  fecha: string;
  /** "HH:mm" o "" (todo el día) */
  hora: string;
}

export function aValorFechaHora(deadline: FechaISO | undefined): ValorFechaHora {
  if (!deadline) return { fecha: '', hora: '' };
  const fecha = parseISO(deadline);
  return { fecha: format(fecha, 'yyyy-MM-dd'), hora: esTodoElDia(deadline) ? '' : format(fecha, 'HH:mm') };
}

export function desdeValorFechaHora({ fecha, hora }: ValorFechaHora): FechaISO | undefined {
  if (!fecha) return undefined;
  const dia = parse(fecha, 'yyyy-MM-dd', new Date());
  if (Number.isNaN(dia.getTime())) return undefined;
  if (!hora) return deadlineTodoElDia(dia);
  return parse(`${fecha} ${hora}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();
}

export function valorDia(dia: Date): string {
  return format(dia, 'yyyy-MM-dd');
}

/** "yyyy-MM-dd" → inicio de ese día local, como ISO. */
export function inicioDelDia(valor: string): FechaISO | undefined {
  const dia = parse(valor, 'yyyy-MM-dd', new Date());
  return Number.isNaN(dia.getTime()) ? undefined : startOfDay(dia).toISOString();
}

/** "yyyy-MM-dd" → fin de ese día ("todo el día"), como ISO. */
export function finDelDia(valor: string): FechaISO | undefined {
  return desdeValorFechaHora({ fecha: valor, hora: '' });
}
