import { ErrorNoEncontrado, ErrorValidacion } from '../../../domain/errores';
import { ordenarNotas } from '../../../domain/orden';
import type { CambiosNota, Nota, NuevaNota } from '../../../domain/types';
import { cumpleFiltroNotas } from '../filtros';
import type { AlCambiar, AlError, Cancelar, DependenciasRepositorio, FiltroNotas, NotaRepository } from '../types';
import { sinIndefinidos, textoOpcional } from '../validacion';
import type { BitacoraDB } from './db';
import { observarConsulta } from './observar';

export class DexieNotaRepository implements NotaRepository {
  private readonly db: BitacoraDB;
  private readonly deps: DependenciasRepositorio;

  constructor(db: BitacoraDB, deps: DependenciasRepositorio) {
    this.db = db;
    this.deps = deps;
  }

  async obtener(id: string): Promise<Nota | undefined> {
    const nota = await this.db.notas.get(id);
    return nota && !nota.eliminadoEn ? nota : undefined;
  }

  async listar(filtro: FiltroNotas = {}): Promise<Nota[]> {
    const coleccion = filtro.proyectoId
      ? this.db.notas.where('proyectoId').equals(filtro.proyectoId)
      : this.db.notas.toCollection();
    return ordenarNotas(await coleccion.filter((n) => cumpleFiltroNotas(n, filtro)).toArray());
  }

  observar(filtro: FiltroNotas, alCambiar: AlCambiar<Nota[]>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.listar(filtro), alCambiar, alError);
  }

  async crear(datos: NuevaNota): Promise<Nota> {
    return this.db.transaction('rw', this.db.notas, this.db.proyectos, async () => {
      const ahora = this.deps.ahora().toISOString();
      const nota: Nota = sinIndefinidos({
        id: this.deps.generarId(),
        proyectoId: await this.validarProyecto(datos.proyectoId),
        titulo: textoOpcional(datos.titulo),
        contenido: datos.contenido?.trim() ?? '',
        fijada: datos.fijada ?? false,
        createdAt: ahora,
        updatedAt: ahora,
      });
      validarNoVacia(nota);
      await this.db.notas.add(nota);
      return nota;
    });
  }

  async actualizar(id: string, cambios: CambiosNota): Promise<Nota> {
    return this.db.transaction('rw', this.db.notas, async () => {
      const actual = await this.requerir(id);
      const siguiente: Nota = { ...actual, updatedAt: this.deps.ahora().toISOString() };

      if (cambios.titulo !== undefined) siguiente.titulo = textoOpcional(cambios.titulo);
      if (cambios.contenido !== undefined) siguiente.contenido = cambios.contenido.trim();
      if (cambios.fijada !== undefined) siguiente.fijada = cambios.fijada;

      const limpia = sinIndefinidos(siguiente);
      validarNoVacia(limpia);
      await this.db.notas.put(limpia);
      return limpia;
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.notas, async () => {
      const actual = await this.requerir(id);
      const ahora = this.deps.ahora().toISOString();
      await this.db.notas.put({ ...actual, eliminadoEn: ahora, updatedAt: ahora });
    });
  }

  async restaurar(id: string): Promise<Nota> {
    return this.db.transaction('rw', this.db.notas, this.db.proyectos, async () => {
      const actual = await this.db.notas.get(id);
      if (!actual) throw new ErrorNoEncontrado('nota', id);
      // Una nota no existe fuera de su proyecto: si el proyecto ya no está, no se restaura.
      await this.validarProyecto(actual.proyectoId);
      const { eliminadoEn: _, ...resto } = actual;
      const restaurada: Nota = { ...resto, updatedAt: this.deps.ahora().toISOString() };
      await this.db.notas.put(restaurada);
      return restaurada;
    });
  }

  private async requerir(id: string): Promise<Nota> {
    const nota = await this.obtener(id);
    if (!nota) throw new ErrorNoEncontrado('nota', id);
    return nota;
  }

  private async validarProyecto(proyectoId: string): Promise<string> {
    const proyecto = proyectoId ? await this.db.proyectos.get(proyectoId) : undefined;
    if (!proyecto || proyecto.eliminadoEn) {
      throw new ErrorValidacion('proyectoId', `No existe el proyecto ${proyectoId}`);
    }
    return proyectoId;
  }
}

function validarNoVacia(nota: Nota): void {
  if (!nota.titulo && !nota.contenido) throw new ErrorValidacion('contenido', 'La nota necesita título o contenido');
}
