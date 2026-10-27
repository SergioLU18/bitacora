import { addDays, parse } from 'date-fns';
import { Hourglass, Trash, UserRound } from 'lucide-react';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useProyectos } from '../../data/hooks';
import { useRepositorios } from '../../data/RepositoryContext';
import { deadlineTodoElDia } from '../../domain/deadline';
import {
  CANCHAS,
  CANCHA_POR_DEFECTO,
  ESTADOS_TAREA,
  PRIORIDADES,
  PRIORIDAD_POR_DEFECTO,
  type Cancha,
  type EstadoTarea,
  type ItemChecklist,
  type Prioridad,
} from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { aValorFechaHora, desdeValorFechaHora, valorDia, type ValorFechaHora } from '../../lib/fechas';
import { Button } from '../../ui/Button';
import { CampoDuracion } from '../../ui/CampoDuracion';
import { conPasoNuevo, EditorChecklist } from './EditorChecklist';
import { Campo, Chip, Input, Segmentado, Select } from '../../ui/Campos';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import type { ModoEditor } from './EditorTareaProvider';
import { useAccionesTarea } from './useAccionesTarea';

const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'bg-peligro',
  media: 'bg-aviso-borde',
  baja: 'bg-texto-3',
};

interface Props {
  abierto: boolean;
  modo: ModoEditor;
  alCerrar: () => void;
}

/** Captura rápida y edición de tareas. Solo el título es obligatorio; Enter guarda. */
export function TareaSheet({ abierto, modo, alCerrar }: Props) {
  const { t } = useI18n();
  const { tareas } = useRepositorios();
  const { mostrar } = useToast();
  const acciones = useAccionesTarea();
  const proyectos = useProyectos();
  const idForm = useId();
  const ids = { notas: useId(), fecha: useId(), hora: useId(), proyecto: useId(), seguimiento: useId() };

  const original = modo.tipo === 'editar' ? modo.tarea : undefined;
  const inicial = modo.tipo === 'editar' ? modo.tarea : modo.predeterminados;

  const [titulo, setTitulo] = useState(original?.titulo ?? '');
  const [notas, setNotas] = useState(original?.notas ?? '');
  const [fechaHora, setFechaHora] = useState<ValorFechaHora>(aValorFechaHora(inicial.deadline));
  const [prioridad, setPrioridad] = useState<Prioridad>(inicial.prioridad ?? PRIORIDAD_POR_DEFECTO);
  const [proyectoId, setProyectoId] = useState(inicial.proyectoId ?? '');
  const [estado, setEstado] = useState<EstadoTarea>(original?.estado ?? 'pendiente');
  const [cancha, setCancha] = useState<Cancha>(inicial.cancha ?? CANCHA_POR_DEFECTO);
  const [seguimiento, setSeguimiento] = useState(original?.seguimiento ? aValorFechaHora(original.seguimiento).fecha : '');
  const [estimadoMin, setEstimadoMin] = useState(original?.estimadoMin);
  const [realMin, setRealMin] = useState(original?.realMin);
  const [checklist, setChecklist] = useState<ItemChecklist[]>(original?.checklist ?? []);
  const [pasoNuevo, setPasoNuevo] = useState('');
  const [duracionesValidas, setDuracionesValidas] = useState({ estimado: true, real: true });
  const [guardando, setGuardando] = useState(false);
  const puedeGuardar = !!titulo.trim() && !guardando && duracionesValidas.estimado && duracionesValidas.real;

  const hoy = valorDia(new Date());
  const manana = valorDia(addDays(new Date(), 1));
  const en2Dias = valorDia(addDays(new Date(), 2));
  const enUnaSemana = valorDia(addDays(new Date(), 7));
  const opcionesProyecto = (proyectos.datos ?? []).filter((p) => p.estado !== 'archivado' || p.id === proyectoId);

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    const deadline = desdeValorFechaHora(fechaHora);
    const pasos = conPasoNuevo(checklist, pasoNuevo);
    // El seguimiento es un día (sin hora) y solo aplica a lo que está en la cancha del cliente.
    const diaSeguimiento =
      cancha === 'cliente' && seguimiento ? deadlineTodoElDia(parse(seguimiento, 'yyyy-MM-dd', new Date())) : undefined;
    const ok = await acciones.conError(
      original
        ? tareas.actualizar(original.id, {
            titulo,
            notas: notas || null,
            deadline: deadline ?? null,
            prioridad,
            proyectoId: proyectoId || null,
            estado,
            estimadoMin: estimadoMin ?? null,
            realMin: realMin ?? null,
            cancha,
            seguimiento: diaSeguimiento ?? null,
            checklist: pasos,
          })
        : tareas.crear({
            titulo,
            notas,
            deadline,
            prioridad,
            estimadoMin,
            cancha,
            seguimiento: diaSeguimiento,
            checklist: pasos,
            ...(proyectoId && { proyectoId }),
          }),
    );
    setGuardando(false);
    if (ok) {
      mostrar({ mensaje: original ? t.tarea.guardada : t.tarea.creada });
      alCerrar();
    }
  };

  // ⌘/Ctrl + Enter guarda desde cualquier campo (incluidas las notas).
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void guardar();
  };

  return (
    <Sheet
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={original ? t.tarea.editar : t.tarea.nueva}
      pie={
        <>
          {original && (
            <Button
              variante="peligro"
              icono={<Trash className="size-4" />}
              onClick={() => {
                void acciones.eliminar(original);
                alCerrar();
              }}
              className="-ml-2"
            >
              {t.acciones.eliminar}
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button onClick={alCerrar} className="max-sm:hidden">
              {t.acciones.cancelar}
            </Button>
            <Button type="submit" form={idForm} variante="primario" disabled={!puedeGuardar}>
              {original ? t.acciones.guardar : t.acciones.crear}
            </Button>
          </div>
        </>
      }
    >
      <form id={idForm} onSubmit={guardar} onKeyDown={alTeclear} className="flex flex-col gap-5">
        <div className="-mx-1 rounded-xl">
          <input
            data-autofocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t.campos.tituloPlaceholder}
            aria-label={t.campos.titulo}
            enterKeyHint="done"
            className="w-full rounded-lg bg-transparent px-1 py-1 text-xl font-semibold tracking-tight placeholder:font-medium placeholder:text-texto-3 focus:outline-none"
          />
          <textarea
            id={ids.notas}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={t.campos.notasPlaceholder}
            aria-label={t.campos.notas}
            rows={2}
            className="mt-1 field-sizing-content min-h-12 w-full resize-none rounded-lg bg-transparent px-1 py-1 text-[16px] text-texto-2 placeholder:text-texto-3 focus:outline-none md:text-sm"
          />
        </div>

        <EditorChecklist items={checklist} alCambiar={setChecklist} nuevo={pasoNuevo} alCambiarNuevo={setPasoNuevo} />

        <Campo etiqueta={t.campos.cancha}>
          <Segmentado
            etiqueta={t.campos.cancha}
            opciones={CANCHAS}
            valor={cancha}
            alCambiar={setCancha}
            render={(c) => (
              <>
                {c === 'cliente' ? <Hourglass className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
                {t.cancha[c]}
              </>
            )}
          />
        </Campo>

        {cancha === 'cliente' && (
          <Campo etiqueta={t.campos.seguimiento} htmlFor={ids.seguimiento} ayuda={t.campos.seguimientoAyuda}>
            <div className="flex flex-wrap gap-2">
              <Chip activo={seguimiento === en2Dias} alCambiar={() => setSeguimiento(en2Dias)}>
                {t.campos.enDias(2)}
              </Chip>
              <Chip activo={seguimiento === enUnaSemana} alCambiar={() => setSeguimiento(enUnaSemana)}>
                {t.campos.enUnaSemana}
              </Chip>
              <Chip activo={!seguimiento} alCambiar={() => setSeguimiento('')}>
                {t.campos.sinSeguimiento}
              </Chip>
            </div>
            <Input
              id={ids.seguimiento}
              type="date"
              aria-label={t.campos.seguimiento}
              value={seguimiento}
              onChange={(e) => setSeguimiento(e.target.value)}
              className="mt-1"
            />
          </Campo>
        )}

        <Campo
          etiqueta={t.campos.fecha}
          htmlFor={ids.fecha}
          ayuda={cancha === 'cliente' ? t.campos.fechaCliente : undefined}
        >
          <div className="flex flex-wrap gap-2">
            <Chip activo={fechaHora.fecha === hoy} alCambiar={() => setFechaHora({ ...fechaHora, fecha: hoy })}>
              {t.fechas.hoy}
            </Chip>
            <Chip activo={fechaHora.fecha === manana} alCambiar={() => setFechaHora({ ...fechaHora, fecha: manana })}>
              {t.fechas.manana}
            </Chip>
            <Chip activo={!fechaHora.fecha} alCambiar={() => setFechaHora({ fecha: '', hora: '' })}>
              {t.campos.sinFecha}
            </Chip>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Input
              id={ids.fecha}
              type="date"
              aria-label={t.campos.dia}
              value={fechaHora.fecha}
              onChange={(e) => setFechaHora({ ...fechaHora, fecha: e.target.value })}
            />
            <Input
              id={ids.hora}
              type="time"
              aria-label={t.campos.horaOpcional}
              title={t.campos.horaOpcional}
              value={fechaHora.hora}
              disabled={!fechaHora.fecha}
              onChange={(e) => setFechaHora({ ...fechaHora, hora: e.target.value })}
            />
          </div>
        </Campo>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta={t.campos.prioridad}>
            <Segmentado
              etiqueta={t.campos.prioridad}
              opciones={PRIORIDADES}
              valor={prioridad}
              alCambiar={setPrioridad}
              render={(p) => (
                <>
                  <span aria-hidden className={cn('size-2 rounded-full', COLOR_PRIORIDAD[p])} />
                  {t.prioridad[p]}
                </>
              )}
            />
          </Campo>
          <Campo etiqueta={t.campos.proyecto} htmlFor={ids.proyecto}>
            <Select id={ids.proyecto} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
              <option value="">{t.campos.sinProyecto}</option>
              {opcionesProyecto.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <CampoDuracion
            etiqueta={t.tiempo.estimado}
            minutos={estimadoMin}
            alCambiar={(m, valido) => {
              setEstimadoMin(m);
              setDuracionesValidas((v) => ({ ...v, estimado: valido }));
            }}
          />
          {original && (
            <CampoDuracion
              etiqueta={t.tiempo.real}
              minutos={realMin}
              sugerencias={[]}
              alCambiar={(m, valido) => {
                setRealMin(m);
                setDuracionesValidas((v) => ({ ...v, real: valido }));
              }}
            />
          )}
        </div>

        {original && (
          <Campo etiqueta={t.campos.estado}>
            <Segmentado
              etiqueta={t.campos.estado}
              opciones={ESTADOS_TAREA}
              valor={estado}
              alCambiar={setEstado}
              render={(e) => t.estadoTarea[e]}
            />
          </Campo>
        )}
      </form>
    </Sheet>
  );
}
