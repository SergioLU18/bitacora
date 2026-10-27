import { Timer } from 'lucide-react';
import { formatearDuracion, type ResumenTiempo } from '../../domain/tiempo';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';

export function tieneDatosDeTiempo(tiempo: ResumenTiempo): boolean {
  return tiempo.estimadoTotal > 0 || tiempo.realTotal > 0;
}

/** Color de la desviación: dentro de ±10 % es neutra; por encima, ámbar; por debajo, verde-azulado (info). */
function claseDesviacion(desviacion: number): string {
  if (desviacion > 10) return 'text-aviso';
  if (desviacion < -10) return 'text-info';
  return 'text-texto-2';
}

/** Bloque de tiempo para el panel lateral del proyecto. */
export function TiempoProyectoPanel({ tiempo }: { tiempo: ResumenTiempo }) {
  const { t } = useI18n();
  const filas = [
    { etiqueta: t.tiempo.estimadoTotal, valor: tiempo.estimadoTotal },
    { etiqueta: t.tiempo.restante, valor: tiempo.estimadoPendiente },
    { etiqueta: t.tiempo.realRegistrado, valor: tiempo.realTotal },
  ];
  return (
    <div className="border-t border-borde pt-3">
      <dt className="mb-2 flex items-center gap-1.5 text-texto-2">
        <Timer className="size-3.5" aria-hidden />
        {t.tiempo.titulo}
      </dt>
      <dd className="space-y-1.5">
        {filas.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="flex justify-between gap-3">
            <span className="text-texto-2">{etiqueta}</span>
            <span className="font-medium tabular-nums">{valor ? formatearDuracion(valor) : '—'}</span>
          </div>
        ))}
        {tiempo.desviacion !== undefined && (
          <p className={cn('pt-1 text-[13px] font-medium', claseDesviacion(tiempo.desviacion))}>
            {t.tiempo.desviacion(tiempo.desviacion)}
          </p>
        )}
      </dd>
    </div>
  );
}

/** Línea compacta para móvil / pantallas medianas. */
export function TiempoProyectoLinea({ tiempo }: { tiempo: ResumenTiempo }) {
  const { t } = useI18n();
  const partes = [
    tiempo.estimadoPendiente > 0 && t.tiempo.restanteCorto(formatearDuracion(tiempo.estimadoPendiente)),
    tiempo.realTotal > 0 && `${t.tiempo.realRegistrado}: ${formatearDuracion(tiempo.realTotal)}`,
  ].filter(Boolean);
  if (partes.length === 0 && tiempo.desviacion === undefined) return null;
  return (
    <p className="-mt-3 mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-texto-2 xl:hidden">
      <Timer className="size-3.5" aria-hidden />
      {partes.join(' · ')}
      {tiempo.desviacion !== undefined && (
        <span className={cn('font-medium', claseDesviacion(tiempo.desviacion))}>
          {partes.length > 0 && '· '}
          {t.tiempo.desviacion(tiempo.desviacion)}
        </span>
      )}
    </p>
  );
}
