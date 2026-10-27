import { addDays, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTareas } from '../../data/hooks';
import { useMapaProyectos } from '../../data/hooks/derivados';
import { usePreferencia } from '../../data/hooks/usePreferencia';
import { DIAS_PROXIMOS, deadlineTodoElDia, rangoProximos } from '../../domain/deadline';
import type { Proyecto, Tarea } from '../../domain/types';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { valorDia } from '../../lib/fechas';
import { Segmentado } from '../../ui/Campos';
import { Pagina } from '../../ui/Pagina';
import { useEditorTarea, usePredeterminadosCaptura } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';
import { CalendarioMes } from './CalendarioMes';
import { DiaMovil, useEtiquetasDia, type Dia } from './Dia';

type Vista = 'semana' | 'mes';
const VISTAS: readonly Vista[] = ['semana', 'mes'];

/** Próximos: calendario semanal (los siguientes 7 días) o mensual navegable. */
export function ProximosView() {
  const { t } = useI18n();
  const ahora = useAhora();
  const [vista, setVista] = usePreferencia<Vista>('vistaProximos', 'semana');

  return (
    <Pagina
      titulo={t.nav.proximos}
      subtitulo={vista === 'semana' ? t.proximos.subtitulo : undefined}
      acciones={
        <Segmentado
          etiqueta={t.proximos.vista}
          opciones={VISTAS}
          valor={vista}
          alCambiar={setVista}
          render={(v) => t.proximos[v]}
          className="w-40 md:w-44"
        />
      }
    >
      {vista === 'semana' ? <VistaSemana ahora={ahora} /> : <CalendarioMes ahora={ahora} />}
    </Pagina>
  );
}

/**
 * Los próximos 7 días.
 * Pantallas anchas: una columna por día. Móvil/tablet: franja de días + tareas del día elegido.
 */
function VistaSemana({ ahora }: { ahora: Date }) {
  const { t } = useI18n();
  const proyectos = useMapaProyectos();
  const rango = rangoProximos(ahora);
  const consulta = useTareas({ estados: ['pendiente', 'en_curso'], deadlineDesde: rango.desde, deadlineHasta: rango.hasta });

  const dias = useMemo<Dia[]>(() => {
    const manana = parseISO(rango.desde);
    const porDia = new Map<string, Tarea[]>();
    for (const tarea of consulta.datos ?? []) {
      const clave = valorDia(parseISO(tarea.deadline!));
      porDia.set(clave, [...(porDia.get(clave) ?? []), tarea]);
    }
    return Array.from({ length: DIAS_PROXIMOS }, (_, i) => {
      const fecha = addDays(manana, i);
      const clave = valorDia(fecha);
      return { fecha, clave, tareas: porDia.get(clave) ?? [] };
    });
  }, [consulta.datos, rango.desde]);

  const [seleccion, setSeleccion] = useState<string | undefined>();
  const diaElegido = dias.find((d) => d.clave === seleccion) ?? dias[0]!;

  // La captura rápida (N o botón flotante) usa el día elegido en móvil, o mañana.
  usePredeterminadosCaptura({ deadline: deadlineTodoElDia(diaElegido.fecha) });

  const vacia = consulta.estado === 'listo' && consulta.datos.length === 0;

  return (
    <>
      {vacia && <p className="-mt-3 mb-5 text-sm text-texto-2">{t.proximos.vacioTexto}</p>}
      <div className="min-[1440px]:hidden">
        <FranjaDias dias={dias} elegido={diaElegido.clave} alElegir={setSeleccion} ahora={ahora} />
        <DiaMovil dia={diaElegido} proyectos={proyectos} ahora={ahora} />
      </div>
      <div className="hidden min-[1440px]:block">
        <Semana dias={dias} proyectos={proyectos} ahora={ahora} />
      </div>
    </>
  );
}

// --- Escritorio: una columna por día ------------------------------------------

function Semana({ dias, proyectos, ahora }: { dias: Dia[]; proyectos: ReadonlyMap<string, Proyecto>; ahora: Date }) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-2">
      <div className="grid min-h-[calc(100dvh-14rem)] grid-cols-[repeat(7,minmax(150px,1fr))] gap-3">
        {dias.map((dia) => (
          <ColumnaDia key={dia.clave} dia={dia} proyectos={proyectos} ahora={ahora} />
        ))}
      </div>
    </div>
  );
}

function ColumnaDia({ dia, proyectos, ahora }: { dia: Dia; proyectos: ReadonlyMap<string, Proyecto>; ahora: Date }) {
  const { t } = useI18n();
  const { nuevaTarea } = useEditorTarea();
  const etiquetas = useEtiquetasDia(dia.fecha, ahora);
  const agregar = () => nuevaTarea({ deadline: deadlineTodoElDia(dia.fecha) });

  return (
    <section
      aria-label={etiquetas.largo}
      className={cn(
        'group/dia flex min-w-0 flex-col rounded-2xl border bg-superficie',
        etiquetas.esManana ? 'border-acento/40' : 'border-borde',
      )}
    >
      <header className="flex items-start gap-2 border-b border-borde px-4 pt-3.5 pb-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-semibold tracking-wide uppercase', etiquetas.esManana ? 'text-acento' : 'text-texto-2')}>
            {etiquetas.principal}
          </p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{etiquetas.numero}</p>
        </div>
        {dia.tareas.length > 0 && (
          <span className="mt-0.5 rounded-full bg-superficie-2 px-2 py-0.5 text-xs font-medium text-texto-2 tabular-nums">
            {dia.tareas.length}
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col px-3 py-2">
        {dia.tareas.length > 0 && (
          <TareaLista tareas={dia.tareas} proyectos={proyectos} ahora={ahora} soloHora seVaAlCompletar etiqueta={etiquetas.largo} />
        )}
        {/* Toda la zona libre de la columna sirve para agregar una tarea ese día. */}
        <button
          type="button"
          onClick={agregar}
          aria-label={t.proximos.agregarEn(etiquetas.largo)}
          className={cn(
            'mt-1 flex min-h-11 flex-1 cursor-pointer items-start gap-2 rounded-xl px-1 py-2 text-left text-sm text-texto-3 transition-colors hover:text-acento',
            dia.tareas.length > 0 && 'opacity-0 group-hover/dia:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Plus className="mt-px size-4 shrink-0" aria-hidden />
          {dia.tareas.length > 0 ? t.acciones.agregarTarea : t.proximos.sinTareas}
        </button>
      </div>
    </section>
  );
}

// --- Móvil / tablet: franja de días + lista del día ---------------------------

function FranjaDias({
  dias,
  elegido,
  alElegir,
  ahora,
}: {
  dias: Dia[];
  elegido: string;
  alElegir: (clave: string) => void;
  ahora: Date;
}) {
  const { t } = useI18n();
  return (
    <div role="tablist" aria-label={t.nav.proximos} className="mb-6 grid grid-cols-7 gap-1 sm:gap-2">
      {dias.map((dia) => (
        <BotonDia key={dia.clave} dia={dia} activo={dia.clave === elegido} alElegir={alElegir} ahora={ahora} />
      ))}
    </div>
  );
}

function BotonDia({ dia, activo, alElegir, ahora }: { dia: Dia; activo: boolean; alElegir: (clave: string) => void; ahora: Date }) {
  const { t } = useI18n();
  const etiquetas = useEtiquetasDia(dia.fecha, ahora);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      aria-label={`${etiquetas.largo}, ${t.conteos.tareas(dia.tareas.length)}`}
      onClick={() => alElegir(dia.clave)}
      className={cn(
        'flex h-[4.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors',
        activo ? 'bg-acento text-sobre-acento shadow-sm' : 'text-texto hover:bg-superficie-2',
      )}
    >
      <span className={cn('text-[11px] font-medium uppercase', activo ? 'opacity-85' : 'text-texto-2')}>{etiquetas.corto}</span>
      <span className="text-lg leading-tight font-semibold tabular-nums">{etiquetas.numero}</span>
      {/* Puntos: uno por tarea, hasta 3. */}
      <span className="flex h-1.5 gap-0.5" aria-hidden>
        {dia.tareas.slice(0, 3).map((tarea) => (
          <span key={tarea.id} className={cn('size-1.5 rounded-full', activo ? 'bg-sobre-acento/80' : 'bg-acento')} />
        ))}
      </span>
    </button>
  );
}

