import type { EntidadBase } from '../../domain/types';
import type { BitacoraDB } from '../repositories/dexie/db';
import { TABLAS_SYNC, type FilaRemota, type RemotoSync, type TablaSync } from './tipos';

/** Filas por petición al subir o bajar. */
const LOTE = 500;

/**
 * Margen al pedir "lo nuevo desde el cursor": una transacción del servidor puede hacerse visible
 * un poco después de otra con marca posterior. Volver a recibir filas es inofensivo.
 */
const SOLAPE_MS = 2 * 60_000;

/**
 * Sincroniza la base local (IndexedDB) con el servidor. La app siempre lee y escribe en local;
 * esto solo mueve cambios:
 *
 * - **Bajar:** pide lo que el servidor recibió desde el último cursor y lo aplica si es más nuevo
 *   que lo local (gana la última edición, por `updatedAt`).
 * - **Subir:** sube todo registro cuya versión local no coincide con la última que el servidor
 *   tiene (`versionesSync`). Comparar versiones en vez de fechas evita perder cambios hechos en
 *   un dispositivo con el reloj atrasado, y no depende de que cada escritura avise.
 *
 * Los borrados son lógicos (`eliminadoEn`), así que viajan como una edición más.
 */
export class MotorSync {
  private readonly db: BitacoraDB;
  private readonly remoto: RemotoSync;

  constructor(db: BitacoraDB, remoto: RemotoSync) {
    this.db = db;
    this.remoto = remoto;
  }

  /** Una pasada completa para el usuario dado: primero bajar, luego subir. */
  async sincronizar(usuarioId: string): Promise<void> {
    await this.prepararUsuario(usuarioId);
    for (const tabla of TABLAS_SYNC) await this.bajar(tabla);
    for (const tabla of TABLAS_SYNC) await this.subir(tabla);
  }

  /** Cuántos registros locales faltan por subir (para mostrar en la interfaz). */
  async pendientes(): Promise<number> {
    let total = 0;
    for (const tabla of TABLAS_SYNC) total += (await this.porSubir(tabla)).length;
    return total;
  }

  /**
   * Si los metadatos son de otra cuenta (o de ninguna), se olvidan: lo que hay en el dispositivo
   * se sube completo a la cuenta actual (también el contenido de los archivos) y se baja todo lo de ella.
   */
  private async prepararUsuario(usuarioId: string): Promise<void> {
    const dueno = await this.db.metaSync.get('usuario');
    if (dueno?.valor === usuarioId) return;
    await this.db.transaction('rw', this.db.versionesSync, this.db.metaSync, this.db.contenidos, async () => {
      await this.db.contenidos.toCollection().modify({ subido: 0 });
      await this.db.versionesSync.clear();
      await this.db.metaSync.clear();
      await this.db.metaSync.put({ clave: 'usuario', valor: usuarioId });
    });
  }

  private async bajar(tabla: TablaSync): Promise<void> {
    const claveCursor = `cursor:${tabla}`;
    const guardado = (await this.db.metaSync.get(claveCursor))?.valor;
    let desde = guardado ? new Date(new Date(guardado).getTime() - SOLAPE_MS).toISOString() : undefined;

    for (;;) {
      const filas = await this.remoto.bajar(tabla, desde, LOTE);
      if (filas.length === 0) break;
      await this.aplicar(tabla, filas);
      const ultimo = filas[filas.length - 1]!.servidor_en!;
      if (!guardado || ultimo > guardado) await this.db.metaSync.put({ clave: claveCursor, valor: ultimo });
      if (filas.length < LOTE) break;
      desde = ultimo;
    }
  }

  private async aplicar(tabla: TablaSync, filas: readonly FilaRemota[]): Promise<void> {
    const almacen = this.db.table<EntidadBase, string>(tabla);
    await this.db.transaction('rw', almacen, this.db.versionesSync, async () => {
      const locales = await almacen.bulkGet(filas.map((f) => f.id));
      const nuevas: EntidadBase[] = [];
      const versiones: Array<{ clave: string; version: string }> = [];
      filas.forEach((fila, i) => {
        const local = locales[i];
        const remota = fila.datos;
        // Si lo local es más nuevo, se queda y su versión sigue pendiente de subir.
        if (local && local.updatedAt > remota.updatedAt) return;
        if (!local || local.updatedAt < remota.updatedAt) nuevas.push(remota);
        versiones.push({ clave: `${tabla}:${fila.id}`, version: remota.updatedAt });
      });
      await almacen.bulkPut(nuevas);
      await this.db.versionesSync.bulkPut(versiones);
    });
  }

  private async subir(tabla: TablaSync): Promise<void> {
    const pendientes = await this.porSubir(tabla);
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE);
      await this.remoto.subir(
        tabla,
        lote.map((datos) => ({ id: datos.id, datos })),
      );
      await this.db.versionesSync.bulkPut(lote.map((d) => ({ clave: `${tabla}:${d.id}`, version: d.updatedAt })));
    }
  }

  private async porSubir(tabla: TablaSync): Promise<EntidadBase[]> {
    const [registros, versiones] = await Promise.all([
      this.db.table<EntidadBase, string>(tabla).toArray(),
      this.db.versionesSync.where('clave').startsWith(`${tabla}:`).toArray(),
    ]);
    const conocidas = new Map(versiones.map((v) => [v.clave.slice(tabla.length + 1), v.version]));
    return registros.filter((r) => conocidas.get(r.id) !== r.updatedAt);
  }
}
