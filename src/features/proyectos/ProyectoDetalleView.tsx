import { Archive, ArchiveRestore, ChevronLeft, Copy, FilePen, ListChecks, Pencil, Plus, Trash, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useArchivos, useHistorial, useNotas, useProyecto, useTareas } from '../../data/hooks';
import { useEstadisticas, useMapaProyectos } from '../../data/hooks/derivados';
import { useRepositorios } from '../../data/RepositoryContext';
import { esperaAlCliente } from '../../domain/cancha';
import { calcularProgreso } from '../../domain/progreso';
import { calcularTiempos } from '../../domain/tiempo';
import { ESTADOS_TAREA, type EstadoTarea, type Proyecto, type Tarea } from '../../domain/types';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { textoDeadline } from '../../lib/fechas';
import { Button, IconButton } from '../../ui/Button';
import { Segmentado } from '../../ui/Campos';
import { useConfirmar } from '../../ui/Confirmar';
import { Pagina } from '../../ui/Pagina';
import { Pestanas } from '../../ui/Pestanas';
import { useToast } from '../../ui/Toast';
import { BarraProgreso, EstadoVacio, ListaCargando } from '../../ui/Varios';
import { ArchivosProyecto, useSubidaArchivos } from '../archivos/ArchivosProyecto';
import { NotasProyecto, useEditorNota } from '../notas/NotasProyecto';
import { useEditorTarea, usePredeterminadosCaptura } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';
import { useCopiarEstado } from './CopiarEstado';
import { useEditorProyecto } from './EditorProyectoProvider';
import { EntregaLinea, EntregaPanel } from './EntregaProyecto';
import { HistorialProyecto, useRegistrarCambio } from './HistorialProyecto';
import { TiempoProyectoLinea, TiempoProyectoPanel, tieneDatosDeTiempo } from './TiempoProyecto';

type Filtro = 'todas' | EstadoTarea;
const FILTROS: readonly Filtro[] = ['todas', ...ESTADOS_TAREA];

type Seccion = 'tareas' | 'notas' | 'archivos' | 'historial';
const SECCIONES: readonly Seccion[] = ['tareas', 'notas', 'archivos', 'historial'];

export function ProyectoDetalleView() {
  const { id = '' } = useParams();
  const proyecto = useProyecto(id);
  if (proyecto.estado === 'listo' && !proyecto.datos) return <Navigate to="/proyectos" replace />;
  if (!proyecto.datos) return <ListaCargando />;
  return <Detalle proyecto={proyecto.datos} />;
}

function Detalle({ proyecto }: { proyecto: Proyecto }) {
  const { t, locale } = useI18n();
  const ahora = useAhora();
  const { proyectos } = useRepositorios();
  const { mostrar } = useToast();
  const confirmar = useConfirmar();
  const navegar = useNavigate();
  const { editarProyecto } = useEditorProyecto();
  const { nuevaTarea } = useEditorTarea();
  const mapaProyectos = useMapaProyectos();
  const tareas = useTareas({ proyectoId: proyecto.id });
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const notas = useNotas({ proyectoId: proyecto.id });
  const editorNota = useEditorNota(proyecto.id);
  const archivos = useArchivos({ proyectoId: proyecto.id });
  const subida = useSubidaArchivos(proyecto.id);
  // La sección vive en la URL para conservarla al volver atrás.
  const [params, setParams] = useSearchParams();
  const seccion: Seccion = SECCIONES.find((s) => s === params.get('seccion')) ?? 'tareas';
  const historial = useHistorial({ proyectoId: proyecto.id });
  const registrarCambio = useRegistrarCambio(proyecto.id);
  const estadisticas = useEstadisticas(ahora);
  const estadistica = estadisticas?.porProyecto.get(proyecto.id);
  const factor = estadisticas?.resumen.factor;
  const cambiarSeccion = (s: Seccion) => setParams(s === 'tareas' ? {} : { seccion: s }, { replace: true });

  usePredeterminadosCaptura({ proyectoId: proyecto.id });

  const todas = useMemo(() => tareas.datos ?? [], [tareas.datos]);
  const progreso = calcularProgreso(todas);
  const tiempo = useMemo(() => calcularTiempos(todas), [todas]);
  const porEstado = useMemo(() => {
    const conteo: Record<Filtro, number> = { todas: todas.length, pendiente: 0, en_curso: 0, hecha: 0 };
    for (const tarea of todas) conteo[tarea.estado]++;
    return conteo;
  }, [todas]);

  // En "Todas", las hechas van al final.
  const visibles = useMemo(() => {
    if (filtro !== 'todas') return todas.filter((x) => x.estado === filtro);
    return [...todas.filter((x) => x.estado !== 'hecha'), ...todas.filter((x) => x.estado === 'hecha')];
  }, [todas, filtro]);

  const esperandoCliente = todas.filter(esperaAlCliente).length;
  const proximo: Tarea | undefined = todas.find((x) => x.estado !== 'hecha' && x.deadline);
  const archivado = proyecto.estado === 'archivado';

  const alternarArchivo = async () => {
    const anterior = proyecto.estado;
    const siguiente = archivado ? 'activo' : 'archivado';
    try {
      await proyectos.actualizar(proyecto.id, { estado: siguiente });
      mostrar({
        mensaje: archivado ? t.proyecto.reactivado : t.proyecto.archivado,
        acciones: [{ texto: t.acciones.deshacer, alHacer: () => void proyectos.actualizar(proyecto.id, { estado: anterior }) }],
      });
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  const eliminar = async () => {
    const { confirmado, casilla } = await confirmar({
      titulo: t.proyecto.eliminarTitulo,
      mensaje: t.proyecto.eliminarMensaje(proyecto.nombre, notas.datos?.length ?? 0, archivos.datos?.length ?? 0),
      textoConfirmar: t.acciones.eliminar,
      peligro: true,
      ...(todas.length > 0 && {
        casilla: {
          etiqueta: t.proyecto.eliminarTareas(todas.length),
          ayuda: t.proyecto.eliminarTareasAyuda,
          valorInicial: true,
        },
      }),
    });
    if (!confirmado) return;
    try {
      await proyectos.eliminar(proyecto.id, casilla || todas.length === 0 ? 'eliminar' : 'desasignar');
      navegar('/proyectos', { replace: true });
      mostrar({ mensaje: t.proyecto.eliminado });
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  const agregar = () => nuevaTarea({ proyectoId: proyecto.id });
  const copiarEstado = useCopiarEstado({
    proyecto,
    tareas: todas,
    eventos: historial.datos ?? [],
    estadistica,
    factor,
    ahora,
  });
  const entrega = { proyecto, estadistica, factor, ahora };

  return (
    <Pagina
      antes={
        <Link
          to="/proyectos"
          className="-ml-1.5 inline-flex h-9 items-center gap-1 rounded-lg pr-2 pl-1 text-sm font-medium text-texto-2 hover:text-texto"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t.proyecto.volver}
        </Link>
      }
      titulo={
        <span className="flex items-center gap-3">
          <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: proyecto.color }} />
          <span className="min-w-0 break-words">{proyecto.nombre}</span>
        </span>
      }
      subtitulo={
        proyecto.cliente || proyecto.descripcion ? (
          <>
            {proyecto.cliente && <span className="font-medium text-texto">{proyecto.cliente}</span>}
            {proyecto.cliente && proyecto.descripcion && ' · '}
            {proyecto.descripcion}
          </>
        ) : proyecto.estado !== 'activo' ? (
          t.estadoProyecto[proyecto.estado]
        ) : undefined
      }
      acciones={
        <>
          <IconButton etiqueta={t.acciones.copiarEstado} onClick={copiarEstado.abrir}>
            <Copy className="size-[18px]" />
          </IconButton>
          <IconButton etiqueta={t.acciones.editar} onClick={() => editarProyecto(proyecto)}>
            <Pencil className="size-[18px]" />
          </IconButton>
          <IconButton etiqueta={archivado ? t.acciones.reactivar : t.acciones.archivar} onClick={() => void alternarArchivo()}>
            {archivado ? <ArchiveRestore className="size-[18px]" /> : <Archive className="size-[18px]" />}
          </IconButton>
          <IconButton etiqueta={t.acciones.eliminar} variante="peligro" onClick={() => void eliminar()}>
            <Trash className="size-[18px]" />
          </IconButton>
          {seccion === 'historial' ? (
            <Button
              variante="primario"
              icono={<FilePen className="size-4" />}
              onClick={registrarCambio.abrir}
              className="ml-2 max-md:hidden"
            >
              {t.acciones.registrarCambio}
            </Button>
          ) : seccion === 'archivos' ? (
            <Button variante="primario" icono={<Upload className="size-4" />} onClick={subida.elegir} className="ml-2 max-md:hidden">
              {t.acciones.subirArchivo}
            </Button>
          ) : seccion === 'notas' ? (
            <Button
              variante="primario"
              icono={<Plus className="size-4" />}
              onClick={() => editorNota.abrir()}
              className="ml-2 max-md:hidden"
            >
              {t.acciones.nuevaNota}
            </Button>
          ) : (
            <Button variante="primario" icono={<Plus className="size-4" />} onClick={agregar} className="ml-2 max-md:hidden">
              {t.acciones.agregarTarea}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <EntregaLinea {...entrega} />
          <Pestanas
            etiqueta={t.proyecto.secciones}
            opciones={SECCIONES}
            valor={seccion}
            alCambiar={cambiarSeccion}
            className="mb-6"
            render={(s) => (
              <>
                {t.proyecto[s]}
                {s !== 'historial' && (
                  <span className="text-texto-3 tabular-nums">
                    {s === 'tareas' ? todas.length : s === 'notas' ? (notas.datos?.length ?? '') : (archivos.datos?.length ?? '')}
                  </span>
                )}
              </>
            )}
          />

          {seccion === 'historial' ? (
            <HistorialProyecto eventos={historial.datos} ahora={ahora} registrar={registrarCambio.abrir} />
          ) : seccion === 'archivos' ? (
            <ArchivosProyecto archivos={archivos.datos} ahora={ahora} elegir={subida.elegir} subir={subida.subir} />
          ) : seccion === 'notas' ? (
            <NotasProyecto notas={notas.datos} ahora={ahora} abrir={editorNota.abrir} />
          ) : (
            <>
              {/* Progreso compacto (en pantallas grandes está en el panel lateral). */}
              {progreso.total > 0 && (
                <div className="mb-6 flex items-center gap-3 xl:hidden">
                  <BarraProgreso
                    porcentaje={progreso.porcentaje}
                    color={proyecto.color}
                    etiqueta={t.proyectos.progresoAria(proyecto.nombre, progreso.porcentaje)}
                    className="flex-1"
                  />
                  <span className="text-[13px] text-texto-2 tabular-nums">{t.proyectos.progreso(progreso.hechas, progreso.total)}</span>
                </div>
              )}
              {tieneDatosDeTiempo(tiempo) && <TiempoProyectoLinea tiempo={tiempo} />}

              {todas.length > 0 && (
                <div className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-oculta md:mx-0 md:px-0">
                  <Segmentado
                    etiqueta={t.campos.estado}
                    opciones={FILTROS}
                    valor={filtro}
                    alCambiar={setFiltro}
                    className="w-max min-w-full sm:min-w-0"
                    render={(f) => (
                      <>
                        {f === 'todas' ? t.proyecto.filtroTodas : t.estadoTarea[f]}
                        <span className="text-texto-3 tabular-nums">{porEstado[f]}</span>
                      </>
                    )}
                  />
                </div>
              )}

              {tareas.estado === 'cargando' && <ListaCargando />}
              {tareas.estado === 'listo' && todas.length === 0 && (
                <EstadoVacio
                  icono={ListChecks}
                  titulo={t.proyecto.vacioTitulo}
                  texto={t.proyecto.vacioTexto}
                  accion={
                    <Button variante="primario" icono={<Plus className="size-4" />} onClick={agregar}>
                      {t.acciones.agregarTarea}
                    </Button>
                  }
                />
              )}
              {todas.length > 0 && visibles.length === 0 && (
                <p className="py-10 text-center text-[15px] text-texto-2 md:text-sm">{t.proyecto.vacioFiltro}</p>
              )}
              {visibles.length > 0 && (
                <TareaLista
                  tareas={visibles}
                  proyectos={mapaProyectos}
                  ahora={ahora}
                  ocultarProyecto
                  seVaAlCompletar={filtro === 'pendiente' || filtro === 'en_curso'}
                />
              )}
              {todas.length > 0 && (
                <button
                  type="button"
                  onClick={agregar}
                  className="mt-1 flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-0.5 text-[15px] text-texto-2 transition-colors hover:text-acento md:h-10 md:text-sm"
                >
                  <span className="flex size-[22px] items-center justify-center">
                    <Plus className="size-[18px]" aria-hidden />
                  </span>
                  {t.acciones.agregarTarea}
                </button>
              )}
            </>
          )}
        </div>

        {/* Panel lateral de resumen (≥1280px). */}
        <aside className="hidden xl:block">
          <div className="sticky top-12 rounded-2xl border border-borde bg-superficie p-5">
            <h2 className="text-[13px] font-semibold tracking-wide text-texto-2 uppercase">{t.proyecto.resumen}</h2>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{progreso.porcentaje}</span>
              <span className="text-lg font-semibold text-texto-2">%</span>
              <span className="ml-1 text-sm text-texto-2">{t.proyecto.completado}</span>
            </p>
            <BarraProgreso
              porcentaje={progreso.porcentaje}
              color={proyecto.color}
              etiqueta={t.proyectos.progresoAria(proyecto.nombre, progreso.porcentaje)}
              className="mt-3"
            />
            <dl className="mt-5 space-y-2.5 text-sm">
              <EntregaPanel {...entrega} />
              {ESTADOS_TAREA.map((e) => (
                <div key={e} className="flex justify-between">
                  <dt className="text-texto-2">{t.estadoTarea[e]}</dt>
                  <dd className="font-medium tabular-nums">{porEstado[e]}</dd>
                </div>
              ))}
              {esperandoCliente > 0 && (
                <div className="flex justify-between">
                  <dt className="text-texto-2">{t.proyecto.esperandoCliente}</dt>
                  <dd className="font-medium text-info tabular-nums">{esperandoCliente}</dd>
                </div>
              )}
              {tieneDatosDeTiempo(tiempo) && <TiempoProyectoPanel tiempo={tiempo} />}
              <div className="border-t border-borde pt-3">
                <dt className="text-texto-2">{t.proyecto.proximoDeadline}</dt>
                <dd className="mt-1 font-medium">
                  {proximo?.deadline ? (
                    <>
                      <span className="block truncate">{proximo.titulo}</span>
                      <span className="text-[13px] font-normal text-texto-2">{textoDeadline(proximo.deadline, ahora, t, locale)}</span>
                    </>
                  ) : (
                    <span className="text-texto-3">{t.proyecto.ninguno}</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
      {editorNota.editor}
      {subida.input}
      {registrarCambio.formulario}
      {copiarEstado.hoja}
    </Pagina>
  );
}
