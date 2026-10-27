import { format, parseISO, startOfDay, type Locale } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  FilePen,
  FolderPlus,
  PackageCheck,
  Plus,
  RotateCcw,
  ScrollText,
  Trash,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRepositorios } from '../../data/RepositoryContext';
import type { DetalleEvento, EventoHistorial } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import type { Mensajes } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { nombreDia, textoDeadline } from '../../lib/fechas';
import { Button, IconButton } from '../../ui/Button';
import { Campo, Textarea } from '../../ui/Campos';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { EstadoVacio, ListaCargando } from '../../ui/Varios';

const ICONO: Record<DetalleEvento['tipo'], LucideIcon> = {
  proyecto_creado: FolderPlus,
  estado_proyecto: Archive,
  entrega_estimada: CalendarClock,
  proyecto_entregado: PackageCheck,
  entrega_deshecha: Undo2,
  tarea_creada: Plus,
  tarea_completada: CircleCheck,
  tarea_reabierta: RotateCcw,
  tarea_eliminada: Trash,
  tarea_restaurada: ArchiveRestore,
  deadline_tarea: CalendarDays,
  cancha: ArrowLeftRight,
  cambio: FilePen,
};

/** Eventos que marcan avance: se destacan con el color de acento. */
const LOGRO = new Set<DetalleEvento['tipo']>(['tarea_completada', 'proyecto_entregado']);

/** Texto legible de un evento. Las fechas se muestran relativas a `ahora`. */
export function textoEvento(detalle: DetalleEvento, ahora: Date, t: Mensajes, locale: Locale): string {
  const fecha = (iso: string | undefined) => (iso ? textoDeadline(iso, ahora, t, locale) : undefined);
  const h = t.historial;
  switch (detalle.tipo) {
    case 'proyecto_creado':
      return h.proyectoCreado;
    case 'estado_proyecto':
      return h.estadoProyecto(t.estadoProyecto[detalle.de], t.estadoProyecto[detalle.a]);
    case 'entrega_estimada':
      return h.entregaEstimada(fecha(detalle.de), fecha(detalle.a));
    case 'proyecto_entregado':
      return h.entregado(fecha(detalle.fecha)!);
    case 'entrega_deshecha':
      return h.entregaDeshecha;
    case 'tarea_creada':
      return h.tareaCreada(detalle.titulo);
    case 'tarea_completada':
      return h.tareaCompletada(detalle.titulo);
    case 'tarea_reabierta':
      return h.tareaReabierta(detalle.titulo);
    case 'tarea_eliminada':
      return h.tareaEliminada(detalle.titulo);
    case 'tarea_restaurada':
      return h.tareaRestaurada(detalle.titulo);
    case 'deadline_tarea':
      return h.deadline(detalle.titulo, fecha(detalle.de), fecha(detalle.a));
    case 'cancha':
      return detalle.a === 'cliente' ? h.alCliente(detalle.titulo) : h.aMi(detalle.titulo);
    case 'cambio':
      return detalle.texto;
  }
}

/** Estado del formulario "Registrar cambio": `abrir()` lo muestra. */
export function useRegistrarCambio(proyectoId: string): { abrir: () => void; formulario: ReactNode } {
  const [estado, setEstado] = useState({ abierto: false, apertura: 0 });
  const abrir = useCallback(() => setEstado((e) => ({ abierto: true, apertura: e.apertura + 1 })), []);
  const formulario = (
    <RegistrarCambioSheet
      key={`cambio-${estado.apertura}`}
      proyectoId={proyectoId}
      abierto={estado.abierto}
      alCerrar={() => setEstado((e) => ({ ...e, abierto: false }))}
    />
  );
  return { abrir, formulario };
}

function RegistrarCambioSheet({ proyectoId, abierto, alCerrar }: { proyectoId: string; abierto: boolean; alCerrar: () => void }) {
  const { t } = useI18n();
  const { historial } = useRepositorios();
  const { mostrar } = useToast();
  const idForm = useId();
  const idTexto = useId();
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!texto.trim() || guardando) return;
    setGuardando(true);
    try {
      await historial.registrarCambio(proyectoId, texto);
      mostrar({ mensaje: t.historial.registrado });
      alCerrar();
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={t.acciones.registrarCambio}
      pie={
        <div className="ml-auto flex gap-2">
          <Button onClick={alCerrar} className="max-sm:hidden">
            {t.acciones.cancelar}
          </Button>
          <Button type="submit" form={idForm} variante="primario" disabled={!texto.trim() || guardando}>
            {t.acciones.guardar}
          </Button>
        </div>
      }
    >
      <form
        id={idForm}
        onSubmit={guardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void guardar()}
      >
        <Campo etiqueta={t.historial.cambio} htmlFor={idTexto} ayuda={t.historial.registrarAyuda}>
          <Textarea
            id={idTexto}
            data-autofocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t.historial.placeholder}
            rows={3}
          />
        </Campo>
      </form>
    </Sheet>
  );
}

/** Línea de tiempo del proyecto, agrupada por día (lo más reciente arriba). */
export function HistorialProyecto({
  eventos,
  ahora,
  registrar,
}: {
  eventos: readonly EventoHistorial[] | undefined;
  ahora: Date;
  registrar: () => void;
}) {
  const { t, locale } = useI18n();
  const { historial } = useRepositorios();
  const { mostrar } = useToast();

  const dias = useMemo(() => {
    const grupos = new Map<string, EventoHistorial[]>();
    for (const evento of eventos ?? []) {
      const clave = startOfDay(parseISO(evento.createdAt)).toISOString();
      grupos.set(clave, [...(grupos.get(clave) ?? []), evento]);
    }
    return [...grupos];
  }, [eventos]);

  const eliminar = async (evento: EventoHistorial) => {
    try {
      await historial.eliminar(evento.id);
      mostrar({
        mensaje: t.historial.eliminado,
        acciones: [{ texto: t.acciones.deshacer, alHacer: () => void historial.restaurar(evento.id) }],
      });
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  if (!eventos) return <ListaCargando filas={3} />;

  const boton = (
    <Button icono={<FilePen className="size-4" />} onClick={registrar}>
      {t.acciones.registrarCambio}
    </Button>
  );

  if (eventos.length === 0) {
    return <EstadoVacio icono={ScrollText} titulo={t.historial.vacioTitulo} texto={t.historial.vacioTexto} accion={boton} />;
  }

  return (
    <div>
      <div className="mb-6 md:hidden">{boton}</div>
      <ol className="flex flex-col gap-6">
        {dias.map(([dia, lista]) => (
          <li key={dia}>
            <h3 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-texto-2 uppercase">
              {nombreDia(parseISO(dia), ahora, t, locale)}
            </h3>
            <ol className="relative flex flex-col">
              {lista.map((evento) => {
                const Icono = ICONO[evento.detalle.tipo];
                const esCambio = evento.detalle.tipo === 'cambio';
                return (
                  <li
                    key={evento.id}
                    className={cn('group flex items-start gap-3 rounded-xl px-2 py-2', esCambio && 'bg-aviso-suave/70')}
                  >
                    <span
                      className={cn(
                        'mt-px flex size-7 shrink-0 items-center justify-center rounded-full',
                        esCambio
                          ? 'bg-aviso-suave text-aviso'
                          : LOGRO.has(evento.detalle.tipo)
                            ? 'bg-acento-suave text-acento'
                            : 'bg-superficie-2 text-texto-2',
                      )}
                    >
                      <Icono className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      {esCambio && <p className="text-xs font-semibold text-aviso">{t.historial.cambio}</p>}
                      <p className="text-[15px] break-words whitespace-pre-wrap md:text-sm">
                        {textoEvento(evento.detalle, ahora, t, locale)}
                      </p>
                    </div>
                    <time dateTime={evento.createdAt} className="shrink-0 pt-1 text-xs text-texto-3 tabular-nums">
                      {format(parseISO(evento.createdAt), 'p', { locale })}
                    </time>
                    {esCambio && (
                      <IconButton
                        etiqueta={t.acciones.eliminar}
                        variante="peligro"
                        onClick={() => void eliminar(evento)}
                        className="-my-1.5 md:!size-8 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                      >
                        <Trash className="size-4" />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
