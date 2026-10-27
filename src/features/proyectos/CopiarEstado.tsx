import { Copy, Share2 } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import type { EstadisticaProyecto } from '../../domain/estadisticas';
import type { EventoHistorial, Proyecto, Tarea } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../../ui/Button';
import { Segmentado } from '../../ui/Campos';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { generarTextoEstado, type ModoEstado } from './textoEstado';

const MODOS: readonly ModoEstado[] = ['cliente', 'interno'];

interface Datos {
  proyecto: Proyecto;
  tareas: readonly Tarea[];
  eventos: readonly EventoHistorial[];
  estadistica: EstadisticaProyecto | undefined;
  factor: number | undefined;
  ahora: Date;
}

/** Hoja "Copiar estado": `abrir()` la muestra con el texto ya generado. */
export function useCopiarEstado(datos: Datos): { abrir: () => void; hoja: ReactNode } {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  return { abrir, hoja: <CopiarEstadoSheet abierto={abierto} alCerrar={() => setAbierto(false)} {...datos} /> };
}

function CopiarEstadoSheet({ abierto, alCerrar, ...datos }: Datos & { abierto: boolean; alCerrar: () => void }) {
  const { t, locale } = useI18n();
  const { mostrar } = useToast();
  const [modo, setModo] = useState<ModoEstado>('cliente');
  const texto = generarTextoEstado({ ...datos, modo, t, locale });
  const puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      mostrar({ mensaje: t.estado.copiado });
      alCerrar();
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  const compartir = async () => {
    try {
      await navigator.share({ title: datos.proyecto.nombre, text: texto });
      alCerrar();
    } catch (error) {
      // Cancelar la hoja de compartir no es un error.
      if ((error as DOMException).name !== 'AbortError') console.error(error);
    }
  };

  return (
    <Sheet
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={t.acciones.copiarEstado}
      pie={
        <div className="ml-auto flex gap-2">
          {puedeCompartir && (
            <Button icono={<Share2 className="size-4" />} onClick={() => void compartir()}>
              {t.acciones.compartir}
            </Button>
          )}
          <Button variante="primario" icono={<Copy className="size-4" />} onClick={() => void copiar()}>
            {t.acciones.copiar}
          </Button>
        </div>
      }
    >
      <Segmentado
        etiqueta={t.estado.modo}
        opciones={MODOS}
        valor={modo}
        alCambiar={setModo}
        render={(m) => (m === 'cliente' ? t.estado.paraCliente : t.estado.interno)}
      />
      <p className="mt-2 text-[13px] text-texto-2">{modo === 'cliente' ? t.estado.ayudaCliente : t.estado.ayudaInterno}</p>
      <pre className="mt-4 max-h-[50dvh] overflow-auto rounded-xl border border-borde bg-superficie-2 p-4 font-sans text-[14px] leading-relaxed whitespace-pre-wrap md:text-[13px]">
        {texto}
      </pre>
    </Sheet>
  );
}
