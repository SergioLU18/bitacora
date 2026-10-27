import { generarResumenPendientes, type OpcionesResumen, type ResumenPendientes } from '../domain/resumen';
import type { Cancelar, Repositorios } from './repositories/types';

/**
 * Genera el resumen exportable de tareas pendientes a partir de los repositorios.
 * Punto de entrada para el futuro plugin del widget de iOS y las notificaciones locales.
 */
export async function obtenerResumenPendientes(
  repos: Repositorios,
  opciones?: OpcionesResumen,
): Promise<ResumenPendientes> {
  const [tareas, proyectos] = await Promise.all([
    repos.tareas.listar({ estados: ['pendiente', 'en_curso'] }),
    repos.proyectos.listar(),
  ]);
  return generarResumenPendientes(tareas, proyectos, opciones);
}

/**
 * Recalcula el resumen cada vez que cambian tareas o proyectos.
 * Uso futuro: `observarResumenPendientes(repos, (r) => WidgetPlugin.guardar(r))`.
 */
export function observarResumenPendientes(
  repos: Repositorios,
  alCambiar: (resumen: ResumenPendientes) => void,
  opciones?: Omit<OpcionesResumen, 'ahora'>,
): Cancelar {
  let tareas: Parameters<typeof generarResumenPendientes>[0] | undefined;
  let proyectos: Parameters<typeof generarResumenPendientes>[1] | undefined;
  const emitir = () => {
    if (tareas && proyectos) alCambiar(generarResumenPendientes(tareas, proyectos, opciones));
  };
  const cancelarTareas = repos.tareas.observar({ estados: ['pendiente', 'en_curso'] }, (t) => {
    tareas = t;
    emitir();
  });
  const cancelarProyectos = repos.proyectos.observar({}, (p) => {
    proyectos = p;
    emitir();
  });
  return () => {
    cancelarTareas();
    cancelarProyectos();
  };
}
