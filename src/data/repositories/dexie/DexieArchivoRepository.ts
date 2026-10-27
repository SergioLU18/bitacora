import { ErrorNoEncontrado, ErrorValidacion } from '../../../domain/errores';
import { TAMANO_MAXIMO_ARCHIVO, type Archivo, type CambiosArchivo, type NuevoArchivo } from '../../../domain/types';
import type {
  AlCambiar,
  AlError,
  ArchivoRepository,
  Cancelar,
  ContenidoArchivo,
  DependenciasRepositorio,
  FiltroArchivos,
} from '../types';
import { sinIndefinidos, textoOpcional, textoRequerido } from '../validacion';
import { bytesDeContenido, type BitacoraDB } from './db';
import { observarConsulta } from './observar';

export class DexieArchivoRepository implements ArchivoRepository {
  private readonly db: BitacoraDB;
  private readonly deps: DependenciasRepositorio;

  constructor(db: BitacoraDB, deps: DependenciasRepositorio) {
    this.db = db;
    this.deps = deps;
  }

  async obtener(id: string): Promise<Archivo | undefined> {
    const archivo = await this.db.archivos.get(id);
    return archivo && !archivo.eliminadoEn ? archivo : undefined;
  }

  async listar(filtro: FiltroArchivos = {}): Promise<Archivo[]> {
    const coleccion = filtro.proyectoId
      ? this.db.archivos.where('proyectoId').equals(filtro.proyectoId)
      : this.db.archivos.toCollection();
    const archivos = await coleccion.filter((a) => !a.eliminadoEn).toArray();
    return archivos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  observar(filtro: FiltroArchivos, alCambiar: AlCambiar<Archivo[]>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.listar(filtro), alCambiar, alError);
  }

  observarContenido(id: string, alCambiar: AlCambiar<ContenidoArchivo | undefined>, alError?: AlError): Cancelar {
    return observarConsulta(
      async () => {
        const registro = await this.db.contenidos.get(id);
        if (!registro) return undefined;
        const archivo = await this.db.archivos.get(id);
        const contenido = new Blob([await bytesDeContenido(registro.contenido)], { type: archivo?.tipo ?? '' });
        return { contenido, enLaNube: registro.subido === 1 };
      },
      alCambiar,
      alError,
    );
  }

  async crear(datos: NuevoArchivo): Promise<Archivo> {
    if (datos.contenido.size > TAMANO_MAXIMO_ARCHIVO) {
      throw new ErrorValidacion('contenido', `El archivo supera ${TAMANO_MAXIMO_ARCHIVO} bytes`);
    }
    // Los bytes se leen antes de abrir la transacción (leer un Blob es asíncrono fuera de IndexedDB).
    const bytes = await datos.contenido.arrayBuffer();
    if (bytes.byteLength !== datos.contenido.size) {
      throw new ErrorValidacion('contenido', `No se pudo leer el archivo ${datos.nombre}`);
    }
    return this.db.transaction('rw', this.db.archivos, this.db.contenidos, this.db.proyectos, async () => {
      const proyecto = datos.proyectoId ? await this.db.proyectos.get(datos.proyectoId) : undefined;
      if (!proyecto || proyecto.eliminadoEn) {
        throw new ErrorValidacion('proyectoId', `No existe el proyecto ${datos.proyectoId}`);
      }
      const ahora = this.deps.ahora().toISOString();
      const archivo: Archivo = sinIndefinidos({
        id: this.deps.generarId(),
        proyectoId: datos.proyectoId,
        nombre: textoRequerido('nombre', datos.nombre),
        tipo: textoOpcional(datos.contenido.type),
        tamano: datos.contenido.size,
        createdAt: ahora,
        updatedAt: ahora,
      });
      await this.db.archivos.add(archivo);
      await this.db.contenidos.put({ id: archivo.id, contenido: bytes, subido: 0 });
      return archivo;
    });
  }

  async actualizar(id: string, cambios: CambiosArchivo): Promise<Archivo> {
    return this.db.transaction('rw', this.db.archivos, async () => {
      const actual = await this.requerir(id);
      const siguiente: Archivo = { ...actual, updatedAt: this.deps.ahora().toISOString() };
      if (cambios.nombre !== undefined) siguiente.nombre = textoRequerido('nombre', cambios.nombre);
      await this.db.archivos.put(siguiente);
      return siguiente;
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.archivos, async () => {
      const actual = await this.requerir(id);
      const ahora = this.deps.ahora().toISOString();
      await this.db.archivos.put({ ...actual, eliminadoEn: ahora, updatedAt: ahora });
    });
  }

  async restaurar(id: string): Promise<Archivo> {
    return this.db.transaction('rw', this.db.archivos, this.db.proyectos, async () => {
      const actual = await this.db.archivos.get(id);
      if (!actual) throw new ErrorNoEncontrado('archivo', id);
      const proyecto = await this.db.proyectos.get(actual.proyectoId);
      if (!proyecto || proyecto.eliminadoEn) {
        throw new ErrorValidacion('proyectoId', `No existe el proyecto ${actual.proyectoId}`);
      }
      const { eliminadoEn: _, ...resto } = actual;
      const restaurado: Archivo = { ...resto, updatedAt: this.deps.ahora().toISOString() };
      await this.db.archivos.put(restaurado);
      return restaurado;
    });
  }

  private async requerir(id: string): Promise<Archivo> {
    const archivo = await this.obtener(id);
    if (!archivo) throw new ErrorNoEncontrado('archivo', id);
    return archivo;
  }
}
