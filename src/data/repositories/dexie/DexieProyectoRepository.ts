import { COLOR_PROYECTO_POR_DEFECTO } from '../../../domain/colores';
import { ErrorNoEncontrado } from '../../../domain/errores';
import type { CambiosProyecto, DetalleEvento, NuevoProyecto, Proyecto } from '../../../domain/types';
import { cumpleFiltroProyectos } from '../filtros';
import type {
  AlCambiar,
  AlError,
  Cancelar,
  DependenciasRepositorio,
  FiltroProyectos,
  ModoTareasAlEliminarProyecto,
  ProyectoRepository,
} from '../types';
import {
  sinIndefinidos,
  textoOpcional,
  textoRequerido,
  validarColor,
  validarEstadoProyecto,
  validarFecha,
} from '../validacion';
import type { BitacoraDB } from './db';
import { observarConsulta } from './observar';
import { registrarEvento } from './registrarEvento';

const compararPorNombre = (a: Proyecto, b: Proyecto) =>
  a.nombre.localeCompare(b.nombre, undefined, { sensitivity: 'base', numeric: true });

export class DexieProyectoRepository implements ProyectoRepository {
  private readonly db: BitacoraDB;
  private readonly deps: DependenciasRepositorio;

  constructor(db: BitacoraDB, deps: DependenciasRepositorio) {
    this.db = db;
    this.deps = deps;
  }

  async obtener(id: string): Promise<Proyecto | undefined> {
    const proyecto = await this.db.proyectos.get(id);
    return proyecto && !proyecto.eliminadoEn ? proyecto : undefined;
  }

  async listar(filtro: FiltroProyectos = {}): Promise<Proyecto[]> {
    const proyectos = await this.db.proyectos.filter((p) => cumpleFiltroProyectos(p, filtro)).toArray();
    return proyectos.sort(compararPorNombre);
  }

  observar(filtro: FiltroProyectos, alCambiar: AlCambiar<Proyecto[]>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.listar(filtro), alCambiar, alError);
  }

  observarUno(id: string, alCambiar: AlCambiar<Proyecto | undefined>, alError?: AlError): Cancelar {
    return observarConsulta(() => this.obtener(id), alCambiar, alError);
  }

  async crear(datos: NuevoProyecto): Promise<Proyecto> {
    return this.db.transaction('rw', this.db.proyectos, this.db.historial, async () => {
      const ahora = this.deps.ahora().toISOString();
      const entregaEstimada = datos.entregaEstimada ? validarFecha('entregaEstimada', datos.entregaEstimada) : undefined;
      const proyecto: Proyecto = sinIndefinidos({
        id: this.deps.generarId(),
        nombre: textoRequerido('nombre', datos.nombre),
        descripcion: textoOpcional(datos.descripcion),
        cliente: textoOpcional(datos.cliente),
        color: validarColor(datos.color ?? COLOR_PROYECTO_POR_DEFECTO),
        estado: validarEstadoProyecto(datos.estado ?? 'activo'),
        inicio: datos.inicio ? validarFecha('inicio', datos.inicio) : undefined,
        entregaEstimada,
        entregaEstimadaInicial: entregaEstimada,
        createdAt: ahora,
        updatedAt: ahora,
      });
      await this.db.proyectos.add(proyecto);
      await registrarEvento(this.db, this.deps, proyecto.id, { tipo: 'proyecto_creado' });
      if (entregaEstimada) await registrarEvento(this.db, this.deps, proyecto.id, { tipo: 'entrega_estimada', a: entregaEstimada });
      return proyecto;
    });
  }

  async actualizar(id: string, cambios: CambiosProyecto): Promise<Proyecto> {
    return this.db.transaction('rw', this.db.proyectos, this.db.historial, async () => {
      const actual = await this.requerir(id);
      const siguiente: Proyecto = { ...actual, updatedAt: this.deps.ahora().toISOString() };

      if (cambios.nombre !== undefined) siguiente.nombre = textoRequerido('nombre', cambios.nombre);
      if (cambios.descripcion !== undefined) siguiente.descripcion = textoOpcional(cambios.descripcion);
      if (cambios.cliente !== undefined) siguiente.cliente = textoOpcional(cambios.cliente);
      if (cambios.color !== undefined) siguiente.color = validarColor(cambios.color);
      if (cambios.estado !== undefined) siguiente.estado = validarEstadoProyecto(cambios.estado);
      const fecha = (campo: string, valor: string | null) => (valor === null ? undefined : validarFecha(campo, valor));
      if (cambios.inicio !== undefined) siguiente.inicio = fecha('inicio', cambios.inicio);
      if (cambios.entregaEstimada !== undefined) {
        siguiente.entregaEstimada = fecha('entregaEstimada', cambios.entregaEstimada);
        // La primera estimación queda guardada para medir la precisión de las siguientes.
        siguiente.entregaEstimadaInicial ??= siguiente.entregaEstimada;
      }
      if (cambios.entregaEstimadaInicial !== undefined) {
        siguiente.entregaEstimadaInicial = fecha('entregaEstimadaInicial', cambios.entregaEstimadaInicial);
      }
      if (cambios.entregadoEn !== undefined) siguiente.entregadoEn = fecha('entregadoEn', cambios.entregadoEn);

      const limpio = sinIndefinidos(siguiente);
      await this.db.proyectos.put(limpio);
      await this.registrarCambios(actual, limpio);
      return limpio;
    });
  }

  archivar(id: string): Promise<Proyecto> {
    return this.actualizar(id, { estado: 'archivado' });
  }

  async eliminar(id: string, modoTareas: ModoTareasAlEliminarProyecto = 'eliminar'): Promise<void> {
    await this.db.transaction('rw', [this.db.proyectos, this.db.tareas, this.db.notas, this.db.archivos, this.db.historial], async () => {
      const actual = await this.requerir(id);
      const ahora = this.deps.ahora().toISOString();
      await this.db.proyectos.put({ ...actual, eliminadoEn: ahora, updatedAt: ahora });
      await this.db.tareas
        .where('proyectoId')
        .equals(id)
        .filter((t) => !t.eliminadoEn)
        .modify((tarea) => {
          if (modoTareas === 'eliminar') tarea.eliminadoEn = ahora;
          else delete tarea.proyectoId;
          tarea.updatedAt = ahora;
        });
      await this.db.notas
        .where('proyectoId')
        .equals(id)
        .filter((n) => !n.eliminadoEn)
        .modify((nota) => {
          nota.eliminadoEn = ahora;
          nota.updatedAt = ahora;
        });
      await this.db.archivos
        .where('proyectoId')
        .equals(id)
        .filter((a) => !a.eliminadoEn)
        .modify((archivo) => {
          archivo.eliminadoEn = ahora;
          archivo.updatedAt = ahora;
        });
      await this.db.historial
        .where('proyectoId')
        .equals(id)
        .filter((e) => !e.eliminadoEn)
        .modify((evento) => {
          evento.eliminadoEn = ahora;
          evento.updatedAt = ahora;
        });
    });
  }

  private async registrarCambios(antes: Proyecto, despues: Proyecto): Promise<void> {
    const registrar = (detalle: DetalleEvento) => registrarEvento(this.db, this.deps, despues.id, detalle);
    if (antes.estado !== despues.estado) await registrar({ tipo: 'estado_proyecto', de: antes.estado, a: despues.estado });
    if (antes.entregaEstimada !== despues.entregaEstimada) {
      await registrar({
        tipo: 'entrega_estimada',
        ...(antes.entregaEstimada && { de: antes.entregaEstimada }),
        ...(despues.entregaEstimada && { a: despues.entregaEstimada }),
      });
    }
    if (antes.entregadoEn !== despues.entregadoEn) {
      await registrar(despues.entregadoEn ? { tipo: 'proyecto_entregado', fecha: despues.entregadoEn } : { tipo: 'entrega_deshecha' });
    }
  }

  private async requerir(id: string): Promise<Proyecto> {
    const proyecto = await this.obtener(id);
    if (!proyecto) throw new ErrorNoEncontrado('proyecto', id);
    return proyecto;
  }
}
