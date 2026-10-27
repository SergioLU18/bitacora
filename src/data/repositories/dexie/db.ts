import Dexie, { type EntityTable } from 'dexie';
import type { Archivo, EventoHistorial, Nota, Proyecto, Tarea } from '../../../domain/types';

export interface RegistroPreferencia {
  clave: string;
  valor: unknown;
}

/** Última versión (`updatedAt`) de cada registro que el servidor ya tiene. Clave: "tabla:id". */
export interface VersionSync {
  clave: string;
  version: string;
}

/** Estado interno de la sincronización (cursores, dueño de los datos). */
export interface RegistroMetaSync {
  clave: string;
  valor: string;
}

/**
 * Contenido de un archivo, guardado en el dispositivo. `subido` (0/1: IndexedDB no indexa
 * booleanos) indica si ya está en Supabase Storage.
 *
 * Se guardan los bytes (ArrayBuffer), no un Blob: en WebKit (iOS) un Blob leído de IndexedDB
 * puede llegar vacío al reabrir la app o enviarse con 0 bytes por `fetch`. Los registros
 * anteriores a este cambio pueden seguir siendo Blob; `bytesDeContenido` normaliza ambos.
 */
export interface RegistroContenido {
  id: string;
  contenido: ArrayBuffer | Blob;
  subido: 0 | 1;
}

/** Bytes de un contenido guardado, venga como ArrayBuffer (actual) o Blob (registros viejos). */
export async function bytesDeContenido(contenido: ArrayBuffer | Blob): Promise<ArrayBuffer> {
  return contenido instanceof Blob ? contenido.arrayBuffer() : contenido;
}

export class BitacoraDB extends Dexie {
  proyectos!: EntityTable<Proyecto, 'id'>;
  tareas!: EntityTable<Tarea, 'id'>;
  notas!: EntityTable<Nota, 'id'>;
  historial!: EntityTable<EventoHistorial, 'id'>;
  archivos!: EntityTable<Archivo, 'id'>;
  contenidos!: EntityTable<RegistroContenido, 'id'>;
  preferencias!: EntityTable<RegistroPreferencia, 'clave'>;
  versionesSync!: EntityTable<VersionSync, 'clave'>;
  metaSync!: EntityTable<RegistroMetaSync, 'clave'>;

  constructor(nombre = 'bitacora') {
    super(nombre);
    // Solo se indexan los campos por los que se consulta. `updatedAt` queda
    // indexado para la futura sincronización incremental ("cambios desde X").
    // Cada cambio de esquema debe ir en una nueva `version(n)`, nunca editando las anteriores.
    this.version(1).stores({
      proyectos: 'id, estado, updatedAt',
      tareas: 'id, proyectoId, estado, deadline, updatedAt',
      preferencias: 'clave',
    });
    // v2: notas de proyecto y "cancha" en las tareas (las existentes quedan del lado propio).
    this.version(2)
      .stores({ notas: 'id, proyectoId, updatedAt' })
      .upgrade((tx) =>
        tx
          .table<Tarea, string>('tareas')
          .toCollection()
          .modify((tarea) => {
            tarea.cancha ??= 'mia';
          }),
      );
    // v3: historial de proyecto. El índice compuesto permite leer los eventos recientes de un proyecto.
    this.version(3).stores({ historial: 'id, proyectoId, [proyectoId+createdAt], updatedAt' });
    // v4: metadatos de la sincronización con Supabase (ver data/sync).
    this.version(4).stores({ versionesSync: 'clave', metaSync: 'clave' });
    // v5: archivos de proyecto (datos sincronizables) y su contenido (solo en el dispositivo).
    this.version(5).stores({ archivos: 'id, proyectoId, updatedAt', contenidos: 'id, subido' });
  }
}
