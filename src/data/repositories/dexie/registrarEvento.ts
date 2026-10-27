import { familia, MS_DESHACER, revierte } from '../../../domain/historial';
import type { DetalleEvento, EventoHistorial } from '../../../domain/types';
import type { DependenciasRepositorio } from '../types';
import type { BitacoraDB } from './db';

/**
 * Anota un evento en el historial del proyecto. Debe llamarse dentro de una transacción que
 * incluya `db.historial`, para que el evento y el cambio que lo provoca se guarden juntos.
 *
 * Si el evento revierte al último de su misma familia en los últimos minutos (p. ej. completar y
 * "Deshacer"), ambos se anulan: el historial cuenta lo que pasó, no los arrepentimientos.
 */
export async function registrarEvento(
  db: BitacoraDB,
  deps: DependenciasRepositorio,
  proyectoId: string,
  detalle: DetalleEvento,
): Promise<void> {
  const ahora = deps.ahora();
  const desde = new Date(ahora.getTime() - MS_DESHACER).toISOString();
  const clave = familia(detalle);
  const anterior = await db.historial
    .where('[proyectoId+createdAt]')
    .between([proyectoId, desde], [proyectoId, ahora.toISOString()], true, true)
    .reverse()
    .filter((e) => !e.eliminadoEn && familia(e.detalle) === clave)
    .first();

  const iso = ahora.toISOString();
  if (anterior && revierte(anterior.detalle, detalle)) {
    await db.historial.put({ ...anterior, eliminadoEn: iso, updatedAt: iso });
    return;
  }
  const evento: EventoHistorial = { id: deps.generarId(), proyectoId, detalle, createdAt: iso, updatedAt: iso };
  await db.historial.add(evento);
}
