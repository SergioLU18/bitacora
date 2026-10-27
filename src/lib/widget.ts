import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Repositorios } from '../data/repositories/types';
import { observarResumenPendientes } from '../data/resumen';
import type { ResumenPendientes } from '../domain/resumen';

/**
 * Puente con el widget de iOS.
 *
 * El widget corre en otro proceso y no puede leer IndexedDB, así que la app le deja el
 * `ResumenPendientes` (ver `domain/resumen.ts`) como JSON en el App Group compartido
 * (`ios/App/App/WidgetPlugin.swift`) y WidgetKit lo vuelve a dibujar. El widget reclasifica
 * las tareas por su deadline en cada refresco, así que el resumen sigue bien aunque la app
 * lleve horas cerrada; lo único que no sabe es lo que cambió en otro dispositivo.
 */
export interface WidgetPlugin {
  /** Guarda el resumen en el App Group y recarga el widget. */
  guardarResumen(opciones: { json: string }): Promise<void>;
}

const Widget = registerPlugin<WidgetPlugin>('Widget');

/** Nombre del esquema de URL que abre la app desde el widget (`bitacora://tarea/<id>`). */
export const ESQUEMA_URL = 'bitacora';

export function hayWidget(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Widget');
}

/** Cantidad de tareas por lista que se exportan: más no caben ni en el widget grande. */
const LIMITE_POR_LISTA = 12;
const ESPERA_MS = 300;

/**
 * Mantiene el widget al día mientras la app está abierta. Agrupa los cambios en ráfaga
 * (p. ej. una sincronización) en una sola escritura. Devuelve la función para detenerlo.
 */
export function iniciarWidget(repos: Repositorios, enviar: WidgetPlugin['guardarResumen'] = Widget.guardarResumen): () => void {
  if (!hayWidget()) {
    if (Capacitor.isNativePlatform()) {
      const cabeceras = ((window as unknown as { Capacitor?: { PluginHeaders?: { name: string }[] } }).Capacitor?.PluginHeaders ?? []).map((h) => h.name);
      console.info('[widget] plugin nativo no disponible; plugins registrados:', cabeceras.join(', '));
    }
    return () => {};
  }

  let pendiente: ResumenPendientes | undefined;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const vaciar = () => {
    temporizador = undefined;
    if (!pendiente) return;
    const resumen = pendiente;
    pendiente = undefined;
    enviar({ json: JSON.stringify(resumen) }).catch((error: unknown) => {
      console.warn('[widget] no se pudo guardar el resumen', error);
    });
  };

  const cancelarObservacion = observarResumenPendientes(
    repos,
    (resumen) => {
      pendiente = resumen;
      if (temporizador === undefined) temporizador = setTimeout(vaciar, ESPERA_MS);
    },
    { limitePorLista: LIMITE_POR_LISTA },
  );

  return () => {
    cancelarObservacion();
    if (temporizador !== undefined) clearTimeout(temporizador);
  };
}

/** Destinos a los que puede llevar un enlace `bitacora://…` (desde el widget o fuera de la app). */
export type Enlace = { tipo: 'vista'; ruta: string } | { tipo: 'tarea'; id: string };

const VISTAS = new Set(['hoy', 'proximos', 'seguimiento', 'proyectos', 'todas']);

/**
 * Interpreta un enlace externo. Formas aceptadas:
 * - `bitacora://hoy` (o cualquier vista principal)
 * - `bitacora://tarea/<id>` abre Hoy y el editor de esa tarea
 * - `bitacora://proyectos/<id>` abre el detalle del proyecto
 * Devuelve `undefined` si no es un enlace de la app.
 */
export function interpretarEnlace(url: string): Enlace | undefined {
  let analizada: URL;
  try {
    analizada = new URL(url);
  } catch {
    return undefined;
  }
  if (analizada.protocol !== `${ESQUEMA_URL}:`) return undefined;
  const segmentos = [analizada.host, ...analizada.pathname.split('/')].filter(Boolean);
  const [cabeza, resto] = segmentos;
  if (!cabeza) return { tipo: 'vista', ruta: '/hoy' };
  if (cabeza === 'tarea' && resto) return { tipo: 'tarea', id: decodeURIComponent(resto) };
  if (cabeza === 'proyectos' && resto) return { tipo: 'vista', ruta: `/proyectos/${encodeURIComponent(decodeURIComponent(resto))}` };
  if (VISTAS.has(cabeza)) return { tipo: 'vista', ruta: `/${cabeza}` };
  return undefined;
}
