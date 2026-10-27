import type {
  Archivo,
  CambiosArchivo,
  CambiosNota,
  CambiosProyecto,
  CambiosTarea,
  Cancha,
  EstadoProyecto,
  EstadoTarea,
  EventoHistorial,
  FechaISO,
  Nota,
  NuevaNota,
  NuevoArchivo,
  NuevaTarea,
  NuevoProyecto,
  Prioridad,
  Proyecto,
  Tarea,
} from '../../domain/types';

/**
 * Contratos de la capa de datos. Los componentes solo conocen estas interfaces;
 * la implementación (Dexie hoy, Supabase mañana) se elige en `crearRepositorios()`.
 *
 * Las entidades con borrado lógico (`eliminadoEn`) nunca se devuelven en
 * consultas ni suscripciones.
 */

/** Cancela una suscripción creada con `observar*`. */
export type Cancelar = () => void;

export type AlCambiar<T> = (valor: T) => void;
export type AlError = (error: unknown) => void;

export interface FiltroProyectos {
  estados?: readonly EstadoProyecto[];
}

export interface FiltroTareas {
  estados?: readonly EstadoTarea[];
  prioridades?: readonly Prioridad[];
  cancha?: Cancha;
  /** `string`: tareas de ese proyecto. `null`: solo tareas sueltas. Ausente: todas. */
  proyectoId?: string | null;
  /** Deadline >= desde (incluido). Implica que la tarea tiene deadline. */
  deadlineDesde?: FechaISO;
  /** Deadline < hasta (excluido). Implica que la tarea tiene deadline. */
  deadlineHasta?: FechaISO;
}

export type ModoTareasAlEliminarProyecto = 'eliminar' | 'desasignar';

export interface ProyectoRepository {
  obtener(id: string): Promise<Proyecto | undefined>;
  listar(filtro?: FiltroProyectos): Promise<Proyecto[]>;
  observar(filtro: FiltroProyectos, alCambiar: AlCambiar<Proyecto[]>, alError?: AlError): Cancelar;
  observarUno(id: string, alCambiar: AlCambiar<Proyecto | undefined>, alError?: AlError): Cancelar;

  crear(datos: NuevoProyecto): Promise<Proyecto>;
  actualizar(id: string, cambios: CambiosProyecto): Promise<Proyecto>;
  archivar(id: string): Promise<Proyecto>;
  /**
   * Borrado lógico del proyecto. Sus tareas se eliminan también (por defecto)
   * o quedan como tareas sueltas. Sus notas, archivos e historial se eliminan siempre.
   */
  eliminar(id: string, modoTareas?: ModoTareasAlEliminarProyecto): Promise<void>;
}

export interface TareaRepository {
  obtener(id: string): Promise<Tarea | undefined>;
  /** Devuelve las tareas en el orden por defecto (ver `compararTareas`). */
  listar(filtro?: FiltroTareas): Promise<Tarea[]>;
  observar(filtro: FiltroTareas, alCambiar: AlCambiar<Tarea[]>, alError?: AlError): Cancelar;
  observarUna(id: string, alCambiar: AlCambiar<Tarea | undefined>, alError?: AlError): Cancelar;

  crear(datos: NuevaTarea): Promise<Tarea>;
  actualizar(id: string, cambios: CambiosTarea): Promise<Tarea>;
  /** Cambia el estado y mantiene `completadaEn` coherente. */
  cambiarEstado(id: string, estado: EstadoTarea): Promise<Tarea>;
  /** Borrado lógico. */
  eliminar(id: string): Promise<void>;
  /** Revierte un borrado lógico (para "Deshacer"). */
  restaurar(id: string): Promise<Tarea>;
}

export interface FiltroNotas {
  proyectoId?: string;
}

export interface NotaRepository {
  obtener(id: string): Promise<Nota | undefined>;
  /** Fijadas primero, luego la editada más recientemente. */
  listar(filtro?: FiltroNotas): Promise<Nota[]>;
  observar(filtro: FiltroNotas, alCambiar: AlCambiar<Nota[]>, alError?: AlError): Cancelar;

  /** Requiere título o contenido. */
  crear(datos: NuevaNota): Promise<Nota>;
  actualizar(id: string, cambios: CambiosNota): Promise<Nota>;
  /** Borrado lógico. */
  eliminar(id: string): Promise<void>;
  /** Revierte un borrado lógico (para "Deshacer"). */
  restaurar(id: string): Promise<Nota>;
}

export interface ContenidoArchivo {
  contenido: Blob;
  /** Ya se subió a la nube (Supabase Storage). */
  enLaNube: boolean;
}

export interface FiltroArchivos {
  proyectoId?: string;
}

/** Archivos de proyecto. El contenido se guarda en el dispositivo; la sincronización lo sube. */
export interface ArchivoRepository {
  obtener(id: string): Promise<Archivo | undefined>;
  /** Del más reciente al más antiguo. */
  listar(filtro?: FiltroArchivos): Promise<Archivo[]>;
  observar(filtro: FiltroArchivos, alCambiar: AlCambiar<Archivo[]>, alError?: AlError): Cancelar;
  /**
   * Contenido guardado en este dispositivo, o `undefined` si no lo hay (los archivos agregados
   * en otro dispositivo solo están en la nube).
   */
  observarContenido(id: string, alCambiar: AlCambiar<ContenidoArchivo | undefined>, alError?: AlError): Cancelar;

  /** Valida nombre y tamaño (`TAMANO_MAXIMO_ARCHIVO`). */
  crear(datos: NuevoArchivo): Promise<Archivo>;
  actualizar(id: string, cambios: CambiosArchivo): Promise<Archivo>;
  /** Borrado lógico (el contenido se conserva para "Deshacer"). */
  eliminar(id: string): Promise<void>;
  restaurar(id: string): Promise<Archivo>;
}

export interface FiltroHistorial {
  proyectoId?: string;
}

/**
 * Historial de proyecto. Los eventos los generan los demás repositorios al cambiar los datos;
 * aquí solo se anotan a mano los cambios (p. ej. de alcance pedidos por el cliente).
 */
export interface HistorialRepository {
  /** Del más reciente al más antiguo. */
  listar(filtro?: FiltroHistorial): Promise<EventoHistorial[]>;
  observar(filtro: FiltroHistorial, alCambiar: AlCambiar<EventoHistorial[]>, alError?: AlError): Cancelar;
  registrarCambio(proyectoId: string, texto: string): Promise<EventoHistorial>;
  /** Solo para cambios anotados a mano. */
  eliminar(id: string): Promise<void>;
  restaurar(id: string): Promise<void>;
}

/** Preferencias locales del dispositivo (no se sincronizan). */
export interface PreferenciasRepository {
  obtener<T>(clave: string): Promise<T | undefined>;
  guardar<T>(clave: string, valor: T): Promise<void>;
}

export interface Repositorios {
  proyectos: ProyectoRepository;
  tareas: TareaRepository;
  notas: NotaRepository;
  archivos: ArchivoRepository;
  historial: HistorialRepository;
  preferencias: PreferenciasRepository;
}

/** Dependencias inyectables, útiles en tests (reloj fijo, ids deterministas). */
export interface DependenciasRepositorio {
  ahora: () => Date;
  generarId: () => string;
}
