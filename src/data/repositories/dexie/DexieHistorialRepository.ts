import { ErrorNoEncontrado, ErrorValidacion } from '../../../domain/errores';
import { ordenarEventos } from '../../../domain/historial';
import type { EventoHistorial } from '../../../domain/types';
import type { AlCambiar, AlError, Cancelar, DependenciasRepositorio, FiltroHistorial, HistorialRepository } from '../types';
import { textoRequerido } from '../validacion';
import type { BitacoraDB } from './db';
import { observarConsulta } from './observar';

export class DexieHistorialRepository implements HistorialRepository {
  private readonly db: BitacoraDB;
  private readonly deps: DependenciasRepositorio;

  constructor(db: BitacoraDB, deps: DependenciasRepositorio) {
    this.db = db;
    this.deps = deps;
  }

  async listar(filtro: FiltroHistorial = {}): Promise<EventoHistorial[]> {
    const coleccion = filtro.proyectoId
      ? this.db.historial.where('proyectoId').equals(filtro.proyectoId)
      : this.db.historial.toCollection();
    return ordenarEventos(await coleccion.filter((e) => !e.eliminadoEn).toArray());
  }

  observar(filtro: FiltroHistorial, alCambiar: AlCambiar<EventoHistorial[]>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.listar(filtro), alCambiar, alError);
  }

  async registrarCambio(proyectoId: string, texto: string): Promise<EventoHistorial> {
    return this.db.transaction('rw', this.db.historial, this.db.proyectos, async () => {
      const proyecto = await this.db.proyectos.get(proyectoId);
      if (!proyecto || proyecto.eliminadoEn) throw new ErrorValidacion('proyectoId', `No existe el proyecto ${proyectoId}`);
      const ahora = this.deps.ahora().toISOString();
      const evento: EventoHistorial = {
        id: this.deps.generarId(),
        proyectoId,
        detalle: { tipo: 'cambio', texto: textoRequerido('texto', texto) },
        createdAt: ahora,
        updatedAt: ahora,
      };
      await this.db.historial.add(evento);
      return evento;
    });
  }

  async eliminar(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.historial, async () => {
      const evento = await this.requerirCambio(id);
      const ahora = this.deps.ahora().toISOString();
      await this.db.historial.put({ ...evento, eliminadoEn: ahora, updatedAt: ahora });
    });
  }

  async restaurar(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.historial, async () => {
      const evento = await this.db.historial.get(id);
      if (!evento || evento.detalle.tipo !== 'cambio') throw new ErrorNoEncontrado('evento', id);
      const { eliminadoEn: _, ...resto } = evento;
      await this.db.historial.put({ ...resto, updatedAt: this.deps.ahora().toISOString() });
    });
  }

  /** Solo los cambios anotados a mano se pueden borrar; lo automático es el registro de lo que pasó. */
  private async requerirCambio(id: string): Promise<EventoHistorial> {
    const evento = await this.db.historial.get(id);
    if (!evento || evento.eliminadoEn || evento.detalle.tipo !== 'cambio') throw new ErrorNoEncontrado('evento', id);
    return evento;
  }
}
