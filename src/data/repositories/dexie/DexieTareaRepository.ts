import Dexie from 'dexie';
import { ErrorNoEncontrado, ErrorValidacion } from '../../../domain/errores';
import { ordenarTareas } from '../../../domain/orden';
import {
  CANCHA_POR_DEFECTO,
  ESTADO_TAREA_POR_DEFECTO,
  PRIORIDAD_POR_DEFECTO,
  type CambiosTarea,
  type DetalleEvento,
  type EstadoTarea,
  type NuevaTarea,
  type Tarea,
} from '../../../domain/types';
import { cumpleFiltroTareas } from '../filtros';
import type {
  AlCambiar,
  AlError,
  Cancelar,
  DependenciasRepositorio,
  FiltroTareas,
  TareaRepository,
} from '../types';
import {
  sinIndefinidos,
  textoOpcional,
  textoRequerido,
  validarCancha,
  validarChecklist,
  validarDuracion,
  validarEstadoTarea,
  validarFecha,
  validarPrioridad,
} from '../validacion';
import type { BitacoraDB } from './db';
import { observarConsulta } from './observar';
import { registrarEvento } from './registrarEvento';

export class DexieTareaRepository implements TareaRepository {
  private readonly db: BitacoraDB;
  private readonly deps: DependenciasRepositorio;

  constructor(db: BitacoraDB, deps: DependenciasRepositorio) {
    this.db = db;
    this.deps = deps;
  }

  async obtener(id: string): Promise<Tarea | undefined> {
    const tarea = await this.db.tareas.get(id);
    return tarea && !tarea.eliminadoEn ? tarea : undefined;
  }

  async listar(filtro: FiltroTareas = {}): Promise<Tarea[]> {
    const { tareas } = this.db;
    // Se usa el índice más selectivo disponible y el resto se filtra en memoria.
    const coleccion =
      filtro.deadlineDesde || filtro.deadlineHasta
        ? tareas
            .where('deadline')
            .between(filtro.deadlineDesde ?? Dexie.minKey, filtro.deadlineHasta ?? Dexie.maxKey, true, false)
        : typeof filtro.proyectoId === 'string'
          ? tareas.where('proyectoId').equals(filtro.proyectoId)
          : tareas.toCollection();
    const resultado = await coleccion.filter((t) => cumpleFiltroTareas(t, filtro)).toArray();
    return ordenarTareas(resultado);
  }

  observar(filtro: FiltroTareas, alCambiar: AlCambiar<Tarea[]>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.listar(filtro), alCambiar, alError);
  }

  observarUna(id: string, alCambiar: AlCambiar<Tarea | undefined>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.obtener(id), alCambiar, alError);
  }

  async crear(datos: NuevaTarea): Promise<Tarea> {
    return this.db.transaction('rw', this.db.tareas, this.db.proyectos, this.db.historial, async () => {
      const ahora = this.deps.ahora().toISOString();
      const estado = validarEstadoTarea(datos.estado ?? ESTADO_TAREA_POR_DEFECTO);
      const tarea: Tarea = {
        id: this.deps.generarId(),
        titulo: textoRequerido('titulo', datos.titulo),
        notas: textoOpcional(datos.notas),
        proyectoId: datos.proyectoId ? await this.validarProyecto(datos.proyectoId) : undefined,
        deadline: datos.deadline ? validarFecha('deadline', datos.deadline) : undefined,
        prioridad: validarPrioridad(datos.prioridad ?? PRIORIDAD_POR_DEFECTO),
        estado,
        completadaEn: estado === 'hecha' ? ahora : undefined,
        estimadoMin: datos.estimadoMin !== undefined ? validarDuracion('estimadoMin', datos.estimadoMin) : undefined,
        realMin: datos.realMin !== undefined ? validarDuracion('realMin', datos.realMin) : undefined,
        cancha: validarCancha(datos.cancha ?? CANCHA_POR_DEFECTO),
        seguimiento: datos.seguimiento ? validarFecha('seguimiento', datos.seguimiento) : undefined,
        checklist: datos.checklist ? validarChecklist(datos.checklist, this.deps.generarId) : undefined,
        createdAt: ahora,
        updatedAt: ahora,
      };
      aplicarCancha(tarea, ahora);
      const limpia = sinIndefinidos(tarea);
      await this.db.tareas.add(limpia);
      if (limpia.proyectoId) {
        await registrarEvento(this.db, this.deps, limpia.proyectoId, {
          tipo: 'tarea_creada',
          tareaId: limpia.id,
          titulo: limpia.titulo,
          cancha: limpia.cancha,
        });
      }
      return limpia;
    });
  }

  async actualizar(id: string, cambios: CambiosTarea): Promise<Tarea> {
    return this.db.transaction('rw', this.db.tareas, this.db.proyectos, this.db.historial, async () => {
      const actual = await this.requerir(id);
      const ahora = this.deps.ahora().toISOString();
      const siguiente: Tarea = { ...actual, updatedAt: ahora };

      if (cambios.titulo !== undefined) siguiente.titulo = textoRequerido('titulo', cambios.titulo);
      if (cambios.notas !== undefined) siguiente.notas = textoOpcional(cambios.notas);
      if (cambios.proyectoId !== undefined) {
        siguiente.proyectoId = cambios.proyectoId === null ? undefined : await this.validarProyecto(cambios.proyectoId);
      }
      if (cambios.deadline !== undefined) {
        siguiente.deadline = cambios.deadline === null ? undefined : validarFecha('deadline', cambios.deadline);
      }
      if (cambios.prioridad !== undefined) siguiente.prioridad = validarPrioridad(cambios.prioridad);
      if (cambios.estimadoMin !== undefined) {
        siguiente.estimadoMin = cambios.estimadoMin === null ? undefined : validarDuracion('estimadoMin', cambios.estimadoMin);
      }
      if (cambios.realMin !== undefined) {
        siguiente.realMin = cambios.realMin === null ? undefined : validarDuracion('realMin', cambios.realMin);
      }
      if (cambios.estado !== undefined) aplicarEstado(siguiente, validarEstadoTarea(cambios.estado), ahora);
      if (cambios.cancha !== undefined) siguiente.cancha = validarCancha(cambios.cancha);
      if (cambios.esperandoDesde !== undefined) {
        siguiente.esperandoDesde =
          cambios.esperandoDesde === null ? undefined : validarFecha('esperandoDesde', cambios.esperandoDesde);
      }
      if (cambios.seguimiento !== undefined) {
        siguiente.seguimiento = cambios.seguimiento === null ? undefined : validarFecha('seguimiento', cambios.seguimiento);
      }
      if (cambios.checklist !== undefined) {
        siguiente.checklist = cambios.checklist === null ? undefined : validarChecklist(cambios.checklist, this.deps.generarId);
      }
      aplicarCancha(siguiente, ahora);

      const limpia = sinIndefinidos(siguiente);
      await this.db.tareas.put(limpia);
      await this.registrarCambios(actual, limpia);
      return limpia;
    });
  }

  cambiarEstado(id: string, estado: EstadoTarea): Promise<Tarea> {
    return this.actualizar(id, { estado });
  }

  async eliminar(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.tareas, this.db.historial, async () => {
      const actual = await this.requerir(id);
      const ahora = this.deps.ahora().toISOString();
      await this.db.tareas.put({ ...actual, eliminadoEn: ahora, updatedAt: ahora });
      if (actual.proyectoId) {
        await registrarEvento(this.db, this.deps, actual.proyectoId, {
          tipo: 'tarea_eliminada',
          tareaId: actual.id,
          titulo: actual.titulo,
        });
      }
    });
  }

  async restaurar(id: string): Promise<Tarea> {
    return this.db.transaction('rw', this.db.tareas, this.db.proyectos, this.db.historial, async () => {
      const actual = await this.db.tareas.get(id);
      if (!actual) throw new ErrorNoEncontrado('tarea', id);
      const { eliminadoEn: _, ...resto } = actual;
      const restaurada: Tarea = { ...resto, updatedAt: this.deps.ahora().toISOString() };
      // Si su proyecto ya no existe, vuelve como tarea suelta.
      if (restaurada.proyectoId) {
        const proyecto = await this.db.proyectos.get(restaurada.proyectoId);
        if (!proyecto || proyecto.eliminadoEn) delete restaurada.proyectoId;
      }
      await this.db.tareas.put(restaurada);
      if (restaurada.proyectoId) {
        await registrarEvento(this.db, this.deps, restaurada.proyectoId, {
          tipo: 'tarea_restaurada',
          tareaId: restaurada.id,
          titulo: restaurada.titulo,
          cancha: restaurada.cancha,
        });
      }
      return restaurada;
    });
  }

  /** Anota en el historial del proyecto lo relevante de una edición: estado, fecha límite y cancha. */
  private async registrarCambios(antes: Tarea, despues: Tarea): Promise<void> {
    const proyectoId = despues.proyectoId;
    if (!proyectoId) return;
    const base = { tareaId: despues.id, titulo: despues.titulo };
    const registrar = (detalle: DetalleEvento) => registrarEvento(this.db, this.deps, proyectoId, detalle);
    if (antes.estado !== 'hecha' && despues.estado === 'hecha') await registrar({ tipo: 'tarea_completada', ...base });
    if (antes.estado === 'hecha' && despues.estado !== 'hecha') await registrar({ tipo: 'tarea_reabierta', ...base });
    if (antes.deadline !== despues.deadline && antes.proyectoId === proyectoId) {
      await registrar({
        tipo: 'deadline_tarea',
        ...base,
        ...(antes.deadline && { de: antes.deadline }),
        ...(despues.deadline && { a: despues.deadline }),
      });
    }
    if (antes.cancha !== despues.cancha) await registrar({ tipo: 'cancha', ...base, a: despues.cancha });
  }

  private async requerir(id: string): Promise<Tarea> {
    const tarea = await this.obtener(id);
    if (!tarea) throw new ErrorNoEncontrado('tarea', id);
    return tarea;
  }

  private async validarProyecto(proyectoId: string): Promise<string> {
    const proyecto = await this.db.proyectos.get(proyectoId);
    if (!proyecto || proyecto.eliminadoEn) {
      throw new ErrorValidacion('proyectoId', `No existe el proyecto ${proyectoId}`);
    }
    return proyectoId;
  }
}

/**
 * Mantiene coherentes los campos de la cancha: al pasar al cliente se anota desde cuándo espera;
 * del lado propio no hay espera ni seguimiento.
 */
function aplicarCancha(tarea: Tarea, ahora: string): void {
  if (tarea.cancha === 'mia') {
    tarea.esperandoDesde = undefined;
    tarea.seguimiento = undefined;
  } else {
    tarea.esperandoDesde ??= ahora;
  }
}

/** Mantiene `completadaEn` coherente con el estado. */
function aplicarEstado(tarea: Tarea, estado: EstadoTarea, ahora: string): void {
  if (estado === 'hecha' && tarea.estado !== 'hecha') tarea.completadaEn = ahora;
  if (estado !== 'hecha') tarea.completadaEn = undefined;
  tarea.estado = estado;
}
