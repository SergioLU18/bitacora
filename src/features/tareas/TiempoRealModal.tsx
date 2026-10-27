import { useState } from 'react';
import { useRepositorios } from '../../data/RepositoryContext';
import { formatearDuracion } from '../../domain/tiempo';
import type { Tarea } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../../ui/Button';
import { CampoDuracion } from '../../ui/CampoDuracion';
import { Modal } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** "¿Cuánto tardó?": registra el tiempo real de una tarea recién completada. */
export function TiempoRealModal({ tarea, abierto, alCerrar }: { tarea?: Tarea; abierto: boolean; alCerrar: () => void }) {
  const { t } = useI18n();
  const { tareas } = useRepositorios();
  const { mostrar } = useToast();
  const [minutos, setMinutos] = useState<number | undefined>(tarea?.realMin ?? tarea?.estimadoMin);
  const [valido, setValido] = useState(true);

  const guardar = async () => {
    if (!tarea || !minutos || !valido) return;
    try {
      await tareas.actualizar(tarea.id, { realMin: minutos });
      mostrar({ mensaje: t.tiempo.registrado });
      alCerrar();
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  // Atajos alrededor del estimado: la mitad, igual, ×1.5 y el doble.
  const estimado = tarea?.estimadoMin;
  const sugerencias = estimado
    ? [...new Set([Math.round(estimado / 2), estimado, Math.round(estimado * 1.5), estimado * 2])].filter((m) => m > 0)
    : undefined;

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={t.tiempo.cuantoTardo}
      pie={
        <>
          <Button onClick={alCerrar}>{t.acciones.cancelar}</Button>
          <Button variante="primario" onClick={() => void guardar()} disabled={!minutos || !valido}>
            {t.acciones.guardar}
          </Button>
        </>
      }
    >
      {tarea && estimado && <p className="mb-4">{t.tiempo.cuantoTardoTexto(tarea.titulo, formatearDuracion(estimado))}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <CampoDuracion
          etiqueta={t.tiempo.real}
          minutos={minutos}
          sugerencias={sugerencias}
          autoFocus
          alCambiar={(m, ok) => {
            setMinutos(m);
            setValido(ok);
          }}
        />
      </form>
    </Modal>
  );
}
