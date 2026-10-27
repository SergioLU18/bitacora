import { CalendarCheck, PackageCheck } from 'lucide-react';
import { useRepositorios } from '../../data/RepositoryContext';
import { entregaProbableDe, type EstadisticaProyecto } from '../../domain/estadisticas';
import type { Proyecto } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { textoDeadline } from '../../lib/fechas';
import { formatearFactor } from '../../lib/numeros';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { useEditorProyecto } from './EditorProyectoProvider';

interface Props {
  proyecto: Proyecto;
  estadistica: EstadisticaProyecto | undefined;
  /** Factor histórico de entrega (mediana); solo se usa si es distinto de 1. */
  factor: number | undefined;
  ahora: Date;
}

function claseRestante(dias: number): string {
  if (dias < 0) return 'text-peligro font-medium';
  if (dias <= 3) return 'text-aviso font-medium';
  return 'text-texto-2';
}

function useMarcarEntregado(proyecto: Proyecto) {
  const { t } = useI18n();
  const { proyectos } = useRepositorios();
  const { mostrar } = useToast();
  return async () => {
    try {
      await proyectos.actualizar(proyecto.id, { entregadoEn: new Date().toISOString() });
      mostrar({
        mensaje: t.proyecto.entregadoToast,
        acciones: [{ texto: t.acciones.deshacer, alHacer: () => void proyectos.actualizar(proyecto.id, { entregadoEn: null }) }],
      });
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };
}

/** Datos derivados comunes a las dos presentaciones. */
function useEntrega({ proyecto, estadistica, factor, ahora }: Props) {
  const { t, locale } = useI18n();
  const fecha = (iso: string) => textoDeadline(iso, ahora, t, locale);
  const original =
    proyecto.entregaEstimadaInicial && proyecto.entregaEstimadaInicial !== proyecto.entregaEstimada
      ? proyecto.entregaEstimadaInicial
      : undefined;
  const probable = entregaProbableDe(proyecto, factor);
  const factorTexto = estadistica?.factor !== undefined ? formatearFactor(estadistica.factor, locale) : undefined;
  return { fecha, original, probable, factorTexto };
}

/** Bloque "Entrega" del panel lateral (≥1280px). */
export function EntregaPanel(props: Props) {
  const { proyecto, estadistica } = props;
  const { t } = useI18n();
  const { editarProyecto } = useEditorProyecto();
  const marcar = useMarcarEntregado(proyecto);
  const { fecha, original, probable, factorTexto } = useEntrega(props);

  return (
    <div className="border-b border-borde pb-3">
      <dt className="mb-1.5 flex items-center gap-1.5 text-texto-2">
        <CalendarCheck className="size-3.5" aria-hidden />
        {t.proyecto.entrega}
      </dt>
      <dd className="space-y-1">
        {proyecto.entregadoEn ? (
          <>
            <p className="flex items-center gap-1.5 font-medium text-acento">
              <PackageCheck className="size-4" aria-hidden />
              {t.proyecto.entregadoEl(fecha(proyecto.entregadoEn))}
            </p>
            {estadistica && (
              <p className="text-[13px] text-texto-2">{t.proyecto.entregadoEnDias(estadistica.diasTranscurridos, factorTexto)}</p>
            )}
          </>
        ) : proyecto.entregaEstimada ? (
          <>
            <p className="font-medium">{fecha(proyecto.entregaEstimada)}</p>
            {estadistica?.diasRestantes !== undefined && (
              <p className={cn('text-[13px]', claseRestante(estadistica.diasRestantes))}>
                {t.proyecto.faltan(estadistica.diasRestantes)}
              </p>
            )}
            {original && <p className="text-[13px] text-texto-3">{t.proyecto.original(fecha(original))}</p>}
            {probable && <p className="text-[13px] text-info">{t.proyecto.probable(fecha(probable))}</p>}
          </>
        ) : (
          <button
            type="button"
            onClick={() => editarProyecto(proyecto)}
            className="cursor-pointer text-[13px] font-medium text-acento hover:text-acento-hover"
          >
            {t.proyecto.definirEntrega}
          </button>
        )}
        {!proyecto.entregadoEn && (
          <Button icono={<PackageCheck className="size-4" />} onClick={() => void marcar()} className="mt-2 w-full">
            {t.acciones.marcarEntregado}
          </Button>
        )}
      </dd>
    </div>
  );
}

/** Línea compacta para móvil y pantallas medianas. */
export function EntregaLinea(props: Props) {
  const { proyecto, estadistica } = props;
  const { t } = useI18n();
  const { editarProyecto } = useEditorProyecto();
  const marcar = useMarcarEntregado(proyecto);
  const { fecha, probable, factorTexto } = useEntrega(props);

  let contenido;
  if (proyecto.entregadoEn) {
    contenido = (
      <span className="font-medium text-acento">
        {t.proyecto.entregadoEl(fecha(proyecto.entregadoEn))}
        {estadistica && <span className="font-normal text-texto-2"> · {t.proyecto.entregadoEnDias(estadistica.diasTranscurridos, factorTexto)}</span>}
      </span>
    );
  } else if (proyecto.entregaEstimada) {
    contenido = (
      <>
        <span>
          {t.proyecto.entrega}: <span className="font-medium text-texto">{fecha(proyecto.entregaEstimada)}</span>
        </span>
        {estadistica?.diasRestantes !== undefined && (
          <span className={claseRestante(estadistica.diasRestantes)}>{t.proyecto.faltan(estadistica.diasRestantes)}</span>
        )}
        {probable && <span className="text-info">{t.proyecto.probable(fecha(probable))}</span>}
      </>
    );
  } else {
    contenido = (
      <button type="button" onClick={() => editarProyecto(proyecto)} className="cursor-pointer font-medium text-acento">
        {t.proyecto.definirEntrega}
      </button>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-texto-2 xl:hidden">
      <CalendarCheck className="size-3.5" aria-hidden />
      {contenido}
      {!proyecto.entregadoEn && proyecto.entregaEstimada && (
        <button type="button" onClick={() => void marcar()} className="cursor-pointer font-medium text-acento">
          {t.acciones.marcarEntregado}
        </button>
      )}
    </div>
  );
}
