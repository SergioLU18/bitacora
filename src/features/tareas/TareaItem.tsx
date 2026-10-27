import { format, parseISO, type Locale } from 'date-fns';
import { ArrowLeftRight, BellRing, CalendarDays, Check, Flag, Hourglass, ListChecks, Timer, Trash } from 'lucide-react';
import { useState } from 'react';
import { diasEsperando, tocaSeguimiento } from '../../domain/cancha';
import { clasificarDeadline, esTodoElDia, type EstadoDeadline } from '../../domain/deadline';
import { progresoChecklist } from '../../domain/progreso';
import { formatearDuracion } from '../../domain/tiempo';
import type { Proyecto, Tarea } from '../../domain/types';
import { useDeslizar } from '../../hooks/useDeslizar';
import { useI18n } from '../../i18n/I18nProvider';
import type { Mensajes } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { nombreDia, textoDeadline } from '../../lib/fechas';
import { IconButton } from '../../ui/Button';
import { PuntoColor } from '../../ui/Varios';
import { CheckTarea } from './CheckTarea';
import { useEditorTarea } from './EditorTareaProvider';
import { useAccionesTarea } from './useAccionesTarea';

const COLOR_DEADLINE: Record<EstadoDeadline, string> = {
  vencida: 'text-peligro font-medium',
  hoy: 'text-aviso font-medium',
  manana: 'text-info',
  semana: 'text-texto-2',
  futuro: 'text-texto-2',
};

/** Tiempos de la microinteracción al completar. */
const MS_CHECK = 380;
const MS_PLIEGUE = 260;

export interface PropsTareaItem {
  tarea: Tarea;
  proyecto?: Proyecto;
  ahora: Date;
  ocultarProyecto?: boolean;
  /** En listas ya agrupadas por día: muestra solo la hora. */
  soloHora?: boolean;
  /** Si la lista oculta las tareas hechas, la fila se pliega al completarla. */
  seVaAlCompletar?: boolean;
}

export function TareaItem({ tarea, proyecto, ahora, ocultarProyecto, soloHora, seVaAlCompletar }: PropsTareaItem) {
  const { t, locale } = useI18n();
  const acciones = useAccionesTarea();
  const { editarTarea } = useEditorTarea();
  const [fase, setFase] = useState<'normal' | 'marcando' | 'plegando'>('normal');

  const hecha = tarea.estado === 'hecha' || fase !== 'normal';

  const alternar = () => {
    if (fase !== 'normal') return;
    if (tarea.estado === 'hecha') {
      void acciones.reabrir(tarea);
      return;
    }
    setFase('marcando');
    window.setTimeout(() => {
      if (seVaAlCompletar) setFase('plegando');
      window.setTimeout(
        () => void acciones.completar(tarea).finally(() => setFase('normal')),
        seVaAlCompletar ? MS_PLIEGUE : 0,
      );
    }, MS_CHECK);
  };

  const { manejadores, desplazamiento, arrastrando, progreso } = useDeslizar({
    alDerecha: alternar,
    alIzquierda: () => void acciones.eliminar(tarea),
  });

  const claseDeadline = tarea.deadline ? clasificarDeadline(tarea.deadline, ahora) : undefined;
  const textoFecha = tarea.deadline && claseDeadline && textoFechaFila(tarea.deadline, claseDeadline, soloHora, ahora, t, locale);

  const mostrarProyecto = proyecto && !ocultarProyecto;
  const tieneTiempo = !!(tarea.estimadoMin || tarea.realMin);
  const esperando = hecha ? undefined : diasEsperando(tarea, ahora);
  const seguimiento = !hecha && tarea.cancha === 'cliente' ? tarea.seguimiento : undefined;
  const pasos = progresoChecklist(tarea);
  const tieneMeta =
    textoFecha ||
    tieneTiempo ||
    mostrarProyecto ||
    esperando !== undefined ||
    seguimiento ||
    pasos ||
    tarea.estado === 'en_curso' ||
    tarea.prioridad === 'alta';

  return (
    <li
      className={cn(
        'grid transition-[grid-template-rows,opacity] ease-out',
        fase === 'plegando' ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
      )}
      style={{ transitionDuration: `${MS_PLIEGUE}ms` }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="group relative overflow-hidden rounded-xl">
          {/* Fondo revelado al deslizar (móvil). */}
          {desplazamiento !== 0 && (
            <div
              aria-hidden
              className={cn(
                'absolute inset-0 flex items-center px-5 transition-colors',
                desplazamiento > 0 ? 'justify-start' : 'justify-end',
                desplazamiento > 0
                  ? progreso >= 1
                    ? 'bg-acento text-sobre-acento'
                    : 'bg-acento-suave text-acento'
                  : progreso >= 1
                    ? 'bg-peligro text-sobre-acento'
                    : 'bg-peligro-suave text-peligro',
              )}
            >
              {desplazamiento > 0 ? (
                <Check className="size-5" style={{ transform: `scale(${0.7 + progreso * 0.3})` }} />
              ) : (
                <Trash className="size-5" style={{ transform: `scale(${0.7 + progreso * 0.3})` }} />
              )}
            </div>
          )}

          <div
            {...manejadores}
            className={cn(
              'relative flex touch-pan-y items-start gap-3 rounded-xl px-3 py-2.5 md:py-2 md:hover:bg-superficie',
              desplazamiento !== 0 && 'bg-fondo',
              !arrastrando && 'transition-transform duration-200 ease-out',
            )}
            style={{ transform: desplazamiento ? `translateX(${desplazamiento}px)` : undefined }}
          >
            <div className="pt-px">
              <CheckTarea
                marcada={hecha}
                prioridad={tarea.prioridad}
                etiqueta={hecha ? t.tarea.marcarPendiente(tarea.titulo) : t.tarea.marcarHecha(tarea.titulo)}
                alCambiar={alternar}
              />
            </div>

            <button
              type="button"
              onClick={() => editarTarea(tarea)}
              className="min-w-0 flex-1 cursor-pointer rounded-md py-px text-left @3xl:flex @3xl:items-center @3xl:gap-6"
            >
              <span
                className={cn(
                  'block text-[16px] leading-snug transition-colors duration-200 md:text-[15px] @3xl:min-w-0 @3xl:flex-1',
                  hecha ? 'text-texto-3 line-through decoration-texto-3' : 'text-texto',
                )}
              >
                {tarea.titulo}
              </span>
              {tieneMeta && (
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-texto-2 @3xl:mt-0 @3xl:shrink-0 @3xl:flex-row-reverse @3xl:flex-nowrap @3xl:gap-x-4">
                  {textoFecha && claseDeadline && (
                    <span className={cn('inline-flex items-center gap-1', hecha ? 'text-texto-3' : COLOR_DEADLINE[claseDeadline])}>
                      <CalendarDays className="size-3.5" aria-hidden />
                      <span className="sr-only">{t.campos.fecha}:</span>
                      {textoFecha}
                    </span>
                  )}
                  {esperando !== undefined && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md bg-info-suave px-1.5 py-px text-xs font-medium text-info tabular-nums"
                      aria-label={t.tarea.esperandoAria(esperando)}
                      title={t.tarea.esperandoAria(esperando)}
                    >
                      <Hourglass className="size-3" aria-hidden />
                      {t.tarea.esperando(esperando)}
                    </span>
                  )}
                  {seguimiento && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        tocaSeguimiento(tarea, ahora) ? 'font-medium text-aviso' : 'text-texto-2',
                      )}
                    >
                      <BellRing className="size-3.5" aria-hidden />
                      {t.tarea.seguimiento(nombreDia(parseISO(seguimiento), ahora, t, locale))}
                    </span>
                  )}
                  {tarea.prioridad === 'alta' && !hecha && (
                    <span className="inline-flex items-center gap-1 text-peligro">
                      <Flag className="size-3.5" aria-hidden />
                      {t.prioridad.alta}
                    </span>
                  )}
                  {tarea.estado === 'en_curso' && (
                    <span className="rounded-md bg-acento-suave px-1.5 py-px text-xs font-medium text-acento">
                      {t.estadoTarea.en_curso}
                    </span>
                  )}
                  {pasos && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 tabular-nums',
                        pasos.hechos === pasos.total && !hecha && 'text-acento',
                      )}
                      aria-label={t.tarea.checklistAria(pasos.hechos, pasos.total)}
                      title={t.tarea.checklistAria(pasos.hechos, pasos.total)}
                    >
                      <ListChecks className="size-3.5" aria-hidden />
                      {`${pasos.hechos}/${pasos.total}`}
                    </span>
                  )}
                  {tieneTiempo && <TiempoTarea estimadoMin={tarea.estimadoMin} realMin={tarea.realMin} />}
                  {mostrarProyecto && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <PuntoColor color={proyecto.color} className="size-2" />
                      <span className="truncate">{proyecto.nombre}</span>
                    </span>
                  )}
                </span>
              )}
              {tarea.prioridad !== 'alta' && <span className="sr-only">{t.tarea.prioridadAria(t.prioridad[tarea.prioridad])}</span>}
            </button>

            {/* Acciones rápidas en escritorio (hover o foco). */}
            {!hecha && (
              <IconButton
                etiqueta={tarea.cancha === 'cliente' ? t.tarea.regresarAMi : t.tarea.pasarAlCliente}
                onClick={() => void acciones.pasarPelota(tarea)}
                className="-my-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:hidden"
              >
                <ArrowLeftRight className="size-4" />
              </IconButton>
            )}
            <IconButton
              etiqueta={t.acciones.eliminar}
              variante="peligro"
              onClick={() => void acciones.eliminar(tarea)}
              className="-my-1 -mr-1.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:hidden"
            >
              <Trash className="size-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </li>
  );
}

/** En listas agrupadas por día solo se muestra la hora (o nada si es "todo el día"), salvo si está vencida. */
function textoFechaFila(
  deadline: string,
  clase: EstadoDeadline,
  soloHora: boolean | undefined,
  ahora: Date,
  t: Mensajes,
  locale: Locale,
): string | undefined {
  if (!soloHora || clase === 'vencida') return textoDeadline(deadline, ahora, t, locale);
  return esTodoElDia(deadline) ? undefined : format(parseISO(deadline), 'p', { locale });
}

/** "45 min", o "1 h → 1 h 30 min" cuando ya se registró el tiempo real (en ámbar si se pasó más de un 10 %). */
function TiempoTarea({ estimadoMin, realMin }: { estimadoMin?: number; realMin?: number }) {
  const { t } = useI18n();
  const excedido = !!(estimadoMin && realMin && realMin > estimadoMin * 1.1);
  const etiqueta =
    estimadoMin && realMin
      ? t.tiempo.realAria(formatearDuracion(estimadoMin), formatearDuracion(realMin))
      : realMin
        ? `${t.tiempo.real}: ${formatearDuracion(realMin)}`
        : `${t.tiempo.estimado}: ${formatearDuracion(estimadoMin!)}`;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" aria-label={etiqueta} title={etiqueta}>
      <Timer className="size-3.5" aria-hidden />
      {estimadoMin && <span>{formatearDuracion(estimadoMin)}</span>}
      {estimadoMin && realMin && <span aria-hidden>→</span>}
      {realMin && <span className={excedido ? 'font-medium text-aviso' : 'font-medium text-texto'}>{formatearDuracion(realMin)}</span>}
    </span>
  );
}
