import { parseISO } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { useId } from 'react';
import { useEstadisticas } from '../../data/hooks/derivados';
import { entregaProbable } from '../../domain/estadisticas';
import { useI18n } from '../../i18n/I18nProvider';
import { finDelDia, inicioDelDia, textoDeadline, valorDia } from '../../lib/fechas';
import { formatearFactor } from '../../lib/numeros';
import { Campo, Input } from '../../ui/Campos';

export interface ValoresEntrega {
  /** "yyyy-MM-dd" o "" en todos los campos. */
  inicio: string;
  entrega: string;
  entregado: string;
  /** La estimación original queda igual a la vigente (corrección manual). */
  reiniciarOriginal: boolean;
  /** Ya se aplicó la sugerencia: no se vuelve a ofrecer sobre la fecha ajustada. */
  sugerenciaUsada: boolean;
}

/** Inicio, entrega estimada (con sugerencia según el historial) y fecha real de entrega. */
export function CamposEntrega({
  valores,
  alCambiar,
  entregaOriginal,
  editando,
}: {
  valores: ValoresEntrega;
  alCambiar: (valores: ValoresEntrega) => void;
  /** Estimación original guardada (solo al editar). */
  entregaOriginal?: string;
  editando: boolean;
}) {
  const { t, locale } = useI18n();
  const ids = { inicio: useId(), entrega: useId(), entregado: useId() };
  const ahora = new Date();
  const factor = useEstadisticas(ahora)?.resumen;
  const cambiar = (cambios: Partial<ValoresEntrega>) => alCambiar({ ...valores, ...cambios });

  const inicioIso = valores.inicio ? inicioDelDia(valores.inicio) : undefined;
  const entregaIso = valores.entrega ? finDelDia(valores.entrega) : undefined;
  // El factor se mide contra la primera estimación: solo se sugiere al fijarla, no al re-estimar.
  const primeraEstimacion = !entregaOriginal || valores.reiniciarOriginal;
  const probable =
    primeraEstimacion &&
    !valores.sugerenciaUsada && !valores.entregado && inicioIso && entregaIso && factor?.factor && Math.abs(factor.factor - 1) >= 0.05
      ? entregaProbable(inicioIso, entregaIso, factor.factor)
      : undefined;
  const mostrarOriginal =
    editando && entregaOriginal && !valores.reiniciarOriginal && valorDia(parseISO(entregaOriginal)) !== valores.entrega;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={t.campos.inicio} htmlFor={ids.inicio}>
          <Input id={ids.inicio} type="date" value={valores.inicio} onChange={(e) => cambiar({ inicio: e.target.value })} />
        </Campo>
        <Campo etiqueta={t.campos.entregaEstimada} htmlFor={ids.entrega}>
          <Input
            id={ids.entrega}
            type="date"
            value={valores.entrega}
            min={valores.inicio || undefined}
            onChange={(e) => cambiar({ entrega: e.target.value })}
          />
        </Campo>
      </div>

      {(probable || mostrarOriginal) && (
        <div className="-mt-2 flex flex-col gap-2 text-[13px]">
          {probable && factor?.factor && (
            <p className="flex items-start gap-2 rounded-xl bg-info-suave px-3 py-2.5 text-info">
              <TrendingUp className="mt-px size-4 shrink-0" aria-hidden />
              <span>
                {t.campos.sugerenciaEntrega(
                  formatearFactor(factor.factor, locale),
                  factor.conEstimacion,
                  textoDeadline(probable, ahora, t, locale),
                )}{' '}
                <button
                  type="button"
                  onClick={() => cambiar({ entrega: valorDia(parseISO(probable)), sugerenciaUsada: true })}
                  className="cursor-pointer font-semibold underline underline-offset-2"
                >
                  {t.campos.usarFecha}
                </button>
              </span>
            </p>
          )}
          {mostrarOriginal && (
            <p className="text-texto-2">
              {t.campos.estimacionOriginal(textoDeadline(entregaOriginal, ahora, t, locale))}{' '}
              {valores.entrega && (
                <button
                  type="button"
                  onClick={() => cambiar({ reiniciarOriginal: true })}
                  className="cursor-pointer font-medium text-acento hover:text-acento-hover"
                >
                  {t.campos.usarComoOriginal}
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {editando && (
        <Campo etiqueta={t.campos.entregadoEn} htmlFor={ids.entregado} ayuda={t.campos.entregadoAyuda}>
          <Input
            id={ids.entregado}
            type="date"
            value={valores.entregado}
            onChange={(e) => cambiar({ entregado: e.target.value })}
          />
        </Campo>
      )}
    </div>
  );
}
