/**
 * Modelo de dominio de Bitácora. Tipos puros, sin dependencias de React ni de la
 * capa de persistencia. Todas las fechas se guardan como strings ISO 8601 en UTC.
 */

export const ESTADOS_PROYECTO = ['activo', 'pausado', 'archivado'] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export const PRIORIDADES = ['baja', 'media', 'alta'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ESTADOS_TAREA = ['pendiente', 'en_curso', 'hecha'] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

/** De quién depende el siguiente paso: de mí o del cliente ("la pelota está en su cancha"). */
export const CANCHAS = ['mia', 'cliente'] as const;
export type Cancha = (typeof CANCHAS)[number];

/** ISO 8601 en UTC, p. ej. "2026-10-11T22:30:00.000Z". */
export type FechaISO = string;

/** Campos comunes a todas las entidades, pensados para sincronización. */
export interface EntidadBase {
  id: string;
  createdAt: FechaISO;
  updatedAt: FechaISO;
  /** Borrado lógico: la entidad se oculta pero se conserva para propagar el borrado al sincronizar. */
  eliminadoEn?: FechaISO;
}

export interface Proyecto extends EntidadBase {
  nombre: string;
  descripcion?: string;
  /** Cliente o contacto del proyecto (texto libre). */
  cliente?: string;
  /** Color hexadecimal (#rrggbb). */
  color: string;
  estado: EstadoProyecto;
  /** Día de inicio. Si falta, cuenta desde `createdAt`. */
  inicio?: FechaISO;
  /** Fecha de entrega comprometida vigente. */
  entregaEstimada?: FechaISO;
  /**
   * Primera estimación de entrega. Se fija sola la primera vez que se pone `entregaEstimada`
   * y sirve para medir qué tan bien se estima (las re-estimaciones no la cambian).
   */
  entregaEstimadaInicial?: FechaISO;
  /** Cuándo se entregó de verdad. */
  entregadoEn?: FechaISO;
}

/** Paso de la checklist de una tarea. */
export interface ItemChecklist {
  id: string;
  texto: string;
  hecho: boolean;
}

export interface Tarea extends EntidadBase {
  titulo: string;
  notas?: string;
  proyectoId?: string;
  deadline?: FechaISO;
  prioridad: Prioridad;
  estado: EstadoTarea;
  completadaEn?: FechaISO;
  /** Tiempo estimado, en minutos. */
  estimadoMin?: number;
  /** Tiempo que tomó en realidad, en minutos. */
  realMin?: number;
  cancha: Cancha;
  /** Desde cuándo está en la cancha del cliente. Solo existe si `cancha` es "cliente". */
  esperandoDesde?: FechaISO;
  /** Día en que toca preguntarle al cliente. Solo existe si `cancha` es "cliente". */
  seguimiento?: FechaISO;
  /** Subtareas en orden. Ausente si no tiene. */
  checklist?: ItemChecklist[];
}

/**
 * Qué pasó en un evento del historial. Los registra el repositorio al cambiar los datos,
 * salvo `cambio`, que lo anota el usuario (p. ej. un cambio de alcance pedido por el cliente).
 */
export type DetalleEvento =
  | { tipo: 'proyecto_creado' }
  | { tipo: 'estado_proyecto'; de: EstadoProyecto; a: EstadoProyecto }
  | { tipo: 'entrega_estimada'; de?: FechaISO; a?: FechaISO }
  | { tipo: 'proyecto_entregado'; fecha: FechaISO }
  | { tipo: 'entrega_deshecha' }
  | { tipo: 'tarea_creada'; tareaId: string; titulo: string; cancha: Cancha }
  | { tipo: 'tarea_completada'; tareaId: string; titulo: string }
  | { tipo: 'tarea_reabierta'; tareaId: string; titulo: string }
  | { tipo: 'tarea_eliminada'; tareaId: string; titulo: string }
  | { tipo: 'tarea_restaurada'; tareaId: string; titulo: string; cancha: Cancha }
  | { tipo: 'deadline_tarea'; tareaId: string; titulo: string; de?: FechaISO; a?: FechaISO }
  | { tipo: 'cancha'; tareaId: string; titulo: string; a: Cancha }
  | { tipo: 'cambio'; texto: string };

export type TipoEvento = DetalleEvento['tipo'];

/** Entrada del historial de un proyecto. `createdAt` es el momento del hecho. */
export interface EventoHistorial extends EntidadBase {
  proyectoId: string;
  detalle: DetalleEvento;
}

/** Nota libre dentro de un proyecto (acuerdos, accesos, ideas…). */
export interface Nota extends EntidadBase {
  proyectoId: string;
  titulo?: string;
  /** Texto plano; puede estar vacío si hay título. */
  contenido: string;
  /** Las fijadas se muestran primero. */
  fijada: boolean;
}

/**
 * Archivo guardado en un proyecto (cotizaciones, contratos…). Aquí solo van los datos que se
 * sincronizan como cualquier entidad; el contenido viaja aparte (Supabase Storage).
 */
export interface Archivo extends EntidadBase {
  proyectoId: string;
  nombre: string;
  /** Tipo MIME, si el sistema lo informa. */
  tipo?: string;
  /** Tamaño en bytes. */
  tamano: number;
}

// --- Datos de entrada -------------------------------------------------------
// En los "Cambios", `null` significa "borrar el campo" y `undefined` "no tocarlo".

export interface NuevoProyecto {
  nombre: string;
  descripcion?: string;
  cliente?: string;
  color?: string;
  estado?: EstadoProyecto;
  inicio?: FechaISO;
  entregaEstimada?: FechaISO;
}

export interface CambiosProyecto {
  nombre?: string;
  descripcion?: string | null;
  cliente?: string | null;
  color?: string;
  estado?: EstadoProyecto;
  inicio?: FechaISO | null;
  /** La primera vez que se pone también fija `entregaEstimadaInicial`. */
  entregaEstimada?: FechaISO | null;
  /** Para corregir la estimación original (p. ej. si se capturó mal). */
  entregaEstimadaInicial?: FechaISO | null;
  entregadoEn?: FechaISO | null;
}

/** Solo el título es obligatorio (captura rápida). */
export interface NuevaTarea {
  titulo: string;
  notas?: string;
  proyectoId?: string;
  deadline?: FechaISO;
  prioridad?: Prioridad;
  estado?: EstadoTarea;
  estimadoMin?: number;
  realMin?: number;
  cancha?: Cancha;
  seguimiento?: FechaISO;
  /** Los ítems sin `id` reciben uno nuevo. */
  checklist?: NuevoItemChecklist[];
}

export interface NuevoItemChecklist {
  id?: string;
  texto: string;
  hecho?: boolean;
}

export interface CambiosTarea {
  titulo?: string;
  notas?: string | null;
  proyectoId?: string | null;
  deadline?: FechaISO | null;
  prioridad?: Prioridad;
  estado?: EstadoTarea;
  estimadoMin?: number | null;
  realMin?: number | null;
  /** Al pasar a "cliente" se anota `esperandoDesde`; al volver a "mia" se borran `esperandoDesde` y `seguimiento`. */
  cancha?: Cancha;
  /** Corrige `esperandoDesde` (p. ej. al deshacer). Se ignora si la tarea queda en la cancha propia. */
  esperandoDesde?: FechaISO | null;
  /** Se ignora si la tarea queda en la cancha propia. */
  seguimiento?: FechaISO | null;
  /** Reemplaza la checklist completa; `null` o `[]` la quitan. */
  checklist?: NuevoItemChecklist[] | null;
}

export interface NuevaNota {
  proyectoId: string;
  titulo?: string;
  contenido?: string;
  fijada?: boolean;
}

export interface CambiosNota {
  titulo?: string | null;
  contenido?: string;
  fijada?: boolean;
}

export interface NuevoArchivo {
  proyectoId: string;
  nombre: string;
  contenido: Blob;
}

export interface CambiosArchivo {
  nombre?: string;
}

/** Tamaño máximo por archivo (el límite de Supabase Storage en el plan gratuito). */
export const TAMANO_MAXIMO_ARCHIVO = 50 * 1024 * 1024;

export const PRIORIDAD_POR_DEFECTO: Prioridad = 'media';
export const ESTADO_TAREA_POR_DEFECTO: EstadoTarea = 'pendiente';
export const CANCHA_POR_DEFECTO: Cancha = 'mia';
