import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTareas } from '../../data/hooks';
import { useMapaProyectos } from '../../data/hooks/derivados';
import { deadlineTodoElDia, esTodoElDia, estaVencida } from '../../domain/deadline';
import type { Proyecto, Tarea } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { capitalizar, valorDia } from '../../lib/fechas';
import { Button, IconButton } from '../../ui/Button';
import { useEditorTarea, usePredeterminadosCaptura } from '../tareas/EditorTareaProvider';
import { DiaMovil, type Dia } from './Dia';

const MAX_CHIPS = 3;

/**
 * Calendario mensual navegable. Cada celda muestra sus tareas (escritorio) o puntos (móvil);
 * debajo se listan las tareas del día seleccionado.
 */
export function CalendarioMes({ ahora }: { ahora: Date }) {
  const { t, locale } = useI18n();
  const proyectos = useMapaProyectos();
  const [mes, setMes] = useState(() => startOfMonth(ahora));
  const [seleccion, setSeleccion] = useState(() => valorDia(ahora));

  // La cuadrícula empieza y termina en semanas completas (lunes o domingo según el idioma).
  const inicio = startOfWeek(mes, { locale });
  const fin = endOfWeek(endOfMonth(mes), { locale });
  const consulta = useTareas({
    estados: ['pendiente', 'en_curso'],
    deadlineDesde: inicio.toISOString(),
    deadlineHasta: addDays(startOfDay(fin), 1).toISOString(),
  });

  const dias = useMemo<Dia[]>(() => {
    const desde = startOfWeek(mes, { locale });
    const hasta = endOfWeek(endOfMonth(mes), { locale });
    const porDia = new Map<string, Tarea[]>();
    for (const tarea of consulta.datos ?? []) {
      const clave = valorDia(parseISO(tarea.deadline!));
      porDia.set(clave, [...(porDia.get(clave) ?? []), tarea]);
    }
    return eachDayOfInterval({ start: desde, end: hasta }).map((fecha) => {
      const clave = valorDia(fecha);
      return { fecha, clave, tareas: porDia.get(clave) ?? [] };
    });
  }, [consulta.datos, mes, locale]);

  const elegido = dias.find((d) => d.clave === seleccion) ?? dias.find((d) => isSameMonth(d.fecha, mes))!;
  usePredeterminadosCaptura({ deadline: deadlineTodoElDia(elegido.fecha) });

  const cambiarMes = (delta: number) => {
    const nuevo = addMonths(mes, delta);
    setMes(nuevo);
    setSeleccion(valorDia(isSameMonth(nuevo, ahora) ? ahora : nuevo));
  };
  const irAHoy = () => {
    setMes(startOfMonth(ahora));
    setSeleccion(valorDia(ahora));
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight" aria-live="polite">
          {capitalizar(format(mes, 'LLLL yyyy', { locale }))}
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <Button onClick={irAHoy} disabled={isSameMonth(mes, ahora) && seleccion === valorDia(ahora)}>
            {t.proximos.irAHoy}
          </Button>
          <IconButton etiqueta={t.proximos.mesAnterior} onClick={() => cambiarMes(-1)}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton etiqueta={t.proximos.mesSiguiente} onClick={() => cambiarMes(1)}>
            <ChevronRight className="size-5" />
          </IconButton>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-2xl border border-borde bg-superficie">
        <div className="grid grid-cols-7 border-b border-borde" aria-hidden>
          {dias.slice(0, 7).map((d) => (
            <div key={d.clave} className="py-2 text-center text-[11px] font-semibold tracking-wide text-texto-2 uppercase md:px-3 md:text-left">
              {format(d.fecha, 'EEE', { locale }).replace('.', '')}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia, i) => (
            <Celda
              key={dia.clave}
              dia={dia}
              ahora={ahora}
              proyectos={proyectos}
              fueraDeMes={!isSameMonth(dia.fecha, mes)}
              elegido={dia.clave === elegido.clave}
              alElegir={() => setSeleccion(dia.clave)}
              ultimaColumna={i % 7 === 6}
            />
          ))}
        </div>
      </div>

      <DiaMovil key={elegido.clave} dia={elegido} proyectos={proyectos} ahora={ahora} />
    </div>
  );
}

function Celda({
  dia,
  ahora,
  proyectos,
  fueraDeMes,
  elegido,
  alElegir,
  ultimaColumna,
}: {
  dia: Dia;
  ahora: Date;
  proyectos: ReadonlyMap<string, Proyecto>;
  fueraDeMes: boolean;
  elegido: boolean;
  alElegir: () => void;
  ultimaColumna: boolean;
}) {
  const { t, locale } = useI18n();
  const { nuevaTarea } = useEditorTarea();
  const esHoy = dia.clave === valorDia(ahora);
  const pasado = dia.clave < valorDia(ahora);
  const largo = capitalizar(format(dia.fecha, t.fechas.formatoDiaLargo, { locale }));
  const restantes = dia.tareas.length - MAX_CHIPS;

  return (
    <div
      className={cn(
        'group/celda relative flex h-14 flex-col border-b border-borde md:h-auto md:min-h-28 md:p-1.5 lg:min-h-32',
        !ultimaColumna && 'border-r',
        fueraDeMes && 'bg-fondo/60',
        elegido && 'bg-acento-suave',
      )}
    >
      {/* Toda la celda selecciona el día; las tareas quedan por encima y abren su edición. */}
      <button
        type="button"
        onClick={alElegir}
        aria-pressed={elegido}
        aria-label={`${largo}, ${t.conteos.tareas(dia.tareas.length)}`}
        className="absolute inset-0 cursor-pointer focus-visible:outline-offset-[-2px]"
      />

      <div className="pointer-events-none relative flex items-center justify-center pt-1.5 md:justify-between md:px-1 md:pt-0.5">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums',
            esHoy ? 'bg-acento font-semibold text-sobre-acento' : fueraDeMes || pasado ? 'text-texto-3' : 'text-texto',
          )}
        >
          {format(dia.fecha, 'd')}
        </span>
        <IconButton
          etiqueta={t.proximos.agregarEn(largo)}
          onClick={() => nuevaTarea({ deadline: deadlineTodoElDia(dia.fecha) })}
          className="pointer-events-auto !size-7 opacity-0 group-hover/celda:opacity-100 focus-visible:opacity-100 max-md:hidden"
        >
          <Plus className="size-4" />
        </IconButton>
      </div>

      {/* Móvil: un punto por tarea (hasta 3). */}
      <span className="pointer-events-none relative mt-1 flex h-1.5 justify-center gap-0.5 md:hidden" aria-hidden>
        {dia.tareas.slice(0, 3).map((tarea) => (
          <span
            key={tarea.id}
            className={cn('size-1.5 rounded-full', estaVencida(tarea, ahora) ? 'bg-peligro' : 'bg-acento')}
          />
        ))}
      </span>

      {/* Escritorio: las primeras tareas del día. */}
      <ul className="pointer-events-none relative mt-1 flex flex-col gap-0.5 max-md:hidden">
        {dia.tareas.slice(0, MAX_CHIPS).map((tarea) => (
          <li key={tarea.id}>
            <ChipTarea tarea={tarea} proyecto={tarea.proyectoId ? proyectos.get(tarea.proyectoId) : undefined} ahora={ahora} />
          </li>
        ))}
        {restantes > 0 && (
          <li className="px-1.5 text-xs font-medium text-texto-2">{t.proximos.mas(restantes)}</li>
        )}
      </ul>
    </div>
  );
}

function ChipTarea({ tarea, proyecto, ahora }: { tarea: Tarea; proyecto?: Proyecto; ahora: Date }) {
  const { locale } = useI18n();
  const { editarTarea } = useEditorTarea();
  const vencida = estaVencida(tarea, ahora);
  const hora = tarea.deadline && !esTodoElDia(tarea.deadline) ? format(parseISO(tarea.deadline), 'p', { locale }) : undefined;

  return (
    <button
      type="button"
      onClick={() => editarTarea(tarea)}
      title={tarea.titulo}
      className="pointer-events-auto flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-superficie-2"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: proyecto?.color ?? 'var(--borde-fuerte)' }}
      />
      <span className={cn('min-w-0 truncate', vencida ? 'text-peligro' : 'text-texto')}>
        {hora && <span className={cn('mr-1 tabular-nums', vencida ? 'text-peligro' : 'text-texto-2')}>{hora}</span>}
        {tarea.titulo}
      </span>
    </button>
  );
}
