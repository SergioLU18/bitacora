import { Link } from 'react-router';
import type { Progreso } from '../../domain/progreso';
import { formatearDuracion } from '../../domain/tiempo';
import type { Proyecto } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { BarraProgreso } from '../../ui/Varios';

export function TarjetaProyecto({
  proyecto,
  progreso,
  restanteMin,
}: {
  proyecto: Proyecto;
  progreso: Progreso;
  /** Suma de estimados de las tareas pendientes. */
  restanteMin?: number;
}) {
  const { t } = useI18n();
  const archivado = proyecto.estado === 'archivado';

  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className={cn(
        'group flex flex-col rounded-2xl border border-borde bg-superficie p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-borde-fuerte hover:shadow-elevada active:scale-[0.99] md:p-5',
        archivado && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-bold"
          style={{ backgroundColor: `color-mix(in srgb, ${proyecto.color} 16%, transparent)`, color: proyecto.color }}
        >
          {proyecto.nombre.charAt(0).toLocaleUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-tight">{proyecto.nombre}</h3>
          {proyecto.cliente && <p className="truncate text-[13px] font-medium text-texto-2">{proyecto.cliente}</p>}
          {proyecto.descripcion ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-texto-2">{proyecto.descripcion}</p>
          ) : (
            proyecto.estado !== 'activo' && <p className="mt-0.5 text-sm text-texto-2">{t.estadoProyecto[proyecto.estado]}</p>
          )}
        </div>
        {proyecto.entregadoEn && (
          <span className="shrink-0 rounded-md bg-acento-suave px-2 py-0.5 text-xs font-medium text-acento">
            {t.proyectos.entregado}
          </span>
        )}
        {proyecto.estado === 'pausado' && proyecto.descripcion && (
          <span className="shrink-0 rounded-md bg-superficie-2 px-2 py-0.5 text-xs font-medium text-texto-2">
            {t.estadoProyecto.pausado}
          </span>
        )}
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="text-texto-2">
            {progreso.total ? t.proyectos.progreso(progreso.hechas, progreso.total) : t.proyectos.sinTareas}
            {restanteMin ? <span className="tabular-nums"> · {t.tiempo.restanteCorto(formatearDuracion(restanteMin))}</span> : null}
          </span>
          {progreso.total > 0 && <span className="font-semibold tabular-nums">{progreso.porcentaje} %</span>}
        </div>
        <BarraProgreso
          porcentaje={progreso.porcentaje}
          color={proyecto.color}
          etiqueta={t.proyectos.progresoAria(proyecto.nombre, progreso.porcentaje)}
        />
      </div>
    </Link>
  );
}
