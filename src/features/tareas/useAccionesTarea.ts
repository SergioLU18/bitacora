import { createElement, useMemo } from 'react';
import { Timer } from 'lucide-react';
import { useRepositorios } from '../../data/RepositoryContext';
import type { Tarea } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast, type AccionToast } from '../../ui/Toast';
import { useEditorTarea } from './EditorTareaProvider';

/** Acciones frecuentes sobre tareas, con toast de "Deshacer" y manejo de errores. */
export function useAccionesTarea() {
  const { tareas } = useRepositorios();
  const { mostrar } = useToast();
  const { t } = useI18n();
  const { registrarTiempo } = useEditorTarea();

  return useMemo(() => {
    const conError = async (operacion: Promise<unknown>) => {
      try {
        await operacion;
        return true;
      } catch (error) {
        console.error(error);
        mostrar({ mensaje: t.errores.generico, tono: 'error' });
        return false;
      }
    };

    return {
      async completar(tarea: Tarea) {
        const anterior = tarea.estado;
        if (!(await conError(tareas.cambiarEstado(tarea.id, 'hecha')))) return;
        const acciones: AccionToast[] = [];
        // Si tenía estimado y aún no se anotó el tiempo real, se ofrece hacerlo ahora.
        if (tarea.estimadoMin && !tarea.realMin) {
          acciones.push({
            texto: t.tiempo.anotar,
            icono: createElement(Timer, { className: 'size-4', 'aria-hidden': true }),
            alHacer: () => registrarTiempo(tarea),
          });
        }
        acciones.push({ texto: t.acciones.deshacer, alHacer: () => void conError(tareas.cambiarEstado(tarea.id, anterior)) });
        mostrar({ mensaje: t.tarea.completada, acciones });
      },
      reabrir(tarea: Tarea) {
        return conError(tareas.cambiarEstado(tarea.id, 'pendiente'));
      },
      /** Alterna la cancha entre "mía" y "del cliente". Deshacer restaura la espera y el seguimiento previos. */
      async pasarPelota(tarea: Tarea) {
        const siguiente = tarea.cancha === 'cliente' ? 'mia' : 'cliente';
        if (!(await conError(tareas.actualizar(tarea.id, { cancha: siguiente })))) return;
        const deshacer =
          tarea.cancha === 'cliente'
            ? { cancha: tarea.cancha, esperandoDesde: tarea.esperandoDesde ?? null, seguimiento: tarea.seguimiento ?? null }
            : { cancha: tarea.cancha };
        mostrar({
          mensaje: siguiente === 'cliente' ? t.tarea.pelotaAlCliente : t.tarea.pelotaAMi,
          acciones: [{ texto: t.acciones.deshacer, alHacer: () => void conError(tareas.actualizar(tarea.id, deshacer)) }],
        });
      },
      async eliminar(tarea: Tarea) {
        if (await conError(tareas.eliminar(tarea.id))) {
          mostrar({
            mensaje: t.tarea.eliminada,
            acciones: [{ texto: t.acciones.deshacer, alHacer: () => void conError(tareas.restaurar(tarea.id)) }],
          });
        }
      },
      conError,
    };
  }, [tareas, mostrar, t, registrarTiempo]);
}
