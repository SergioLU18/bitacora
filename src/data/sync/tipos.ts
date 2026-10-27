import type { EntidadBase } from '../../domain/types';

/** Tablas que se sincronizan. Las preferencias (idioma…) son de cada dispositivo y no viajan. */
export const TABLAS_SYNC = ['proyectos', 'tareas', 'notas', 'archivos', 'historial'] as const;
export type TablaSync = (typeof TABLAS_SYNC)[number];

/** Una fila tal como viaja al servidor: la entidad completa en `datos`. */
export interface FilaRemota {
  id: string;
  datos: EntidadBase;
  /** Cuándo la recibió el servidor (solo al bajar). Es el cursor de "lo nuevo desde X". */
  servidor_en?: string;
}

/** Lo que el motor necesita del servidor. Supabase lo implementa; los tests usan uno en memoria. */
export interface RemotoSync {
  /** Inserta o actualiza. El servidor descarta las versiones más viejas que la que ya tiene. */
  subir(tabla: TablaSync, filas: readonly FilaRemota[]): Promise<void>;
  /** Filas con `servidor_en` posterior a `desde`, en orden de `servidor_en`. */
  bajar(tabla: TablaSync, desde: string | undefined, limite: number): Promise<FilaRemota[]>;
}

/** El almacén de contenidos de archivos (Supabase Storage). Rutas: "<usuario>/<archivo>". */
export interface RemotoArchivos {
  /** Sube o reemplaza el contenido. */
  subir(ruta: string, contenido: ArrayBuffer, tipo: string | undefined): Promise<void>;
  /**
   * Enlace temporal al contenido, o `undefined` si aún no está en el servidor.
   * Con `descargarComo`, el servidor lo entrega como descarga con ese nombre.
   */
  enlace(ruta: string, descargarComo?: string): Promise<string | undefined>;
}

/** `iniciando`: Supabase aún no dice si hay sesión guardada; la app espera antes de pedir acceso. */
export type FaseSync = 'desactivada' | 'iniciando' | 'sin-sesion' | 'sincronizando' | 'al-dia' | 'sin-conexion' | 'error';

export interface EstadoSync {
  fase: FaseSync;
  /** Correo de la sesión iniciada. */
  correo?: string;
  /** Cuenta nueva: entró con código y aún no ha creado su contraseña. */
  sinContrasena?: boolean;
  /** Última sincronización completa (ISO). */
  ultimaVez?: string;
  error?: string;
}
