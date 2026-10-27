import { bytesDeContenido, type BitacoraDB } from '../repositories/dexie/db';
import type { RemotoArchivos } from './tipos';

/** Ruta del contenido de un archivo en Storage: la carpeta de la cuenta es lo que protege la RLS. */
export const rutaArchivo = (usuarioId: string, archivoId: string) => `${usuarioId}/${archivoId}`;

/**
 * Sube a Storage el contenido de los archivos agregados en este dispositivo. Los datos del
 * archivo (nombre, tamaño…) viajan con el motor como cualquier entidad; esto solo mueve bytes.
 * El contenido de los archivos eliminados también se sube: "Deshacer" en otro dispositivo lo necesita.
 */
export class SubidaArchivos {
  private readonly db: BitacoraDB;
  private readonly remoto: RemotoArchivos;

  constructor(db: BitacoraDB, remoto: RemotoArchivos) {
    this.db = db;
    this.remoto = remoto;
  }

  async subirPendientes(usuarioId: string): Promise<void> {
    const pendientes = await this.db.contenidos.where('subido').equals(0).primaryKeys();
    let primerError: unknown;
    for (const id of pendientes) {
      // Se lee uno a uno para no tener todos los archivos en memoria a la vez.
      const registro = await this.db.contenidos.get(id);
      if (!registro || registro.subido) continue;
      const archivo = await this.db.archivos.get(id);
      try {
        const bytes = await bytesDeContenido(registro.contenido);
        if (bytes.byteLength === 0 && (archivo?.tamano ?? 0) > 0) {
          // El dispositivo perdió el contenido (Blob vacío en IndexedDB): no hay nada que subir.
          throw new Error(`El contenido de «${archivo?.nombre ?? id}» se perdió en este dispositivo`);
        }
        await this.remoto.subir(rutaArchivo(usuarioId, id), bytes, archivo?.tipo);
        await this.db.contenidos.update(id, { subido: 1 });
      } catch (error) {
        // Un archivo que falla no detiene a los demás; el error se informa al final.
        primerError ??= error;
      }
    }
    if (primerError !== undefined) throw primerError;
  }

  pendientes(): Promise<number> {
    return this.db.contenidos.where('subido').equals(0).count();
  }
}
