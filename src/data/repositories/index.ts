import { generarId } from '../../lib/id';
import { DexieArchivoRepository } from './dexie/DexieArchivoRepository';
import { BitacoraDB } from './dexie/db';
import { DexieHistorialRepository } from './dexie/DexieHistorialRepository';
import { DexieNotaRepository } from './dexie/DexieNotaRepository';
import { DexiePreferenciasRepository } from './dexie/DexiePreferenciasRepository';
import { DexieProyectoRepository } from './dexie/DexieProyectoRepository';
import { DexieTareaRepository } from './dexie/DexieTareaRepository';
import type { DependenciasRepositorio, Repositorios } from './types';

export type * from './types';

export interface OpcionesRepositorios extends Partial<DependenciasRepositorio> {
  /** Nombre de la base IndexedDB (útil para aislar tests). */
  nombreDB?: string;
  /** Base ya abierta (la comparte la sincronización). Si se pasa, se ignora `nombreDB`. */
  db?: BitacoraDB;
}

/**
 * Único punto donde se decide la implementación de la capa de datos.
 * Los datos viven en el dispositivo; la sincronización con Supabase (data/sync) trabaja por debajo.
 */
export function crearRepositorios(opciones: OpcionesRepositorios = {}): Repositorios {
  const db = opciones.db ?? new BitacoraDB(opciones.nombreDB);
  const deps: DependenciasRepositorio = {
    ahora: opciones.ahora ?? (() => new Date()),
    generarId: opciones.generarId ?? generarId,
  };
  return {
    proyectos: new DexieProyectoRepository(db, deps),
    tareas: new DexieTareaRepository(db, deps),
    notas: new DexieNotaRepository(db, deps),
    archivos: new DexieArchivoRepository(db, deps),
    historial: new DexieHistorialRepository(db, deps),
    preferencias: new DexiePreferenciasRepository(db),
  };
}
