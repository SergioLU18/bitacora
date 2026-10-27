import { useMemo } from 'react';
import { useRepositorios } from '../../data/RepositoryContext';
import type { Nota } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast } from '../../ui/Toast';

/** Acciones sobre notas, con toast de "Deshacer" y manejo de errores. */
export function useAccionesNota() {
  const { notas } = useRepositorios();
  const { mostrar } = useToast();
  const { t } = useI18n();

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
      alternarFijada(nota: Nota) {
        return conError(notas.actualizar(nota.id, { fijada: !nota.fijada }));
      },
      async eliminar(nota: Nota) {
        if (await conError(notas.eliminar(nota.id))) {
          mostrar({
            mensaje: t.notas.eliminada,
            acciones: [{ texto: t.acciones.deshacer, alHacer: () => void conError(notas.restaurar(nota.id)) }],
          });
        }
      },
      conError,
    };
  }, [notas, mostrar, t]);
}
