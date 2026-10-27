import { ChevronDown, FolderKanban, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useProyectos, useTareas } from '../../data/hooks';
import { calcularProgresoPorProyecto, type Progreso } from '../../domain/progreso';
import type { EstadoProyecto, Proyecto } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { Button, IconButton } from '../../ui/Button';
import { useAhora } from '../../hooks/useAhora';
import { Pagina, Seccion } from '../../ui/Pagina';
import { Pestanas } from '../../ui/Pestanas';
import { EstadoVacio } from '../../ui/Varios';
import { useEditorProyecto } from './EditorProyectoProvider';
import { EstadisticasProyectos } from './EstadisticasProyectos';
import { TarjetaProyecto } from './TarjetaProyecto';

const SIN_PROGRESO: Progreso = { total: 0, hechas: 0, porcentaje: 0 };

type Vista = 'proyectos' | 'estadisticas';
const VISTAS: readonly Vista[] = ['proyectos', 'estadisticas'];

export function ProyectosView() {
  const { t } = useI18n();
  const { nuevoProyecto } = useEditorProyecto();
  const proyectos = useProyectos();
  const tareas = useTareas();
  const [verArchivados, setVerArchivados] = useState(false);
  const ahora = useAhora();
  // La vista vive en la URL para conservarla al volver atrás.
  const [params, setParams] = useSearchParams();
  const vista: Vista = params.get('vista') === 'estadisticas' ? 'estadisticas' : 'proyectos';
  const cambiarVista = (v: Vista) => setParams(v === 'proyectos' ? {} : { vista: v }, { replace: true });

  const progreso = useMemo(() => calcularProgresoPorProyecto(tareas.datos ?? []), [tareas.datos]);
  const restantes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const tarea of tareas.datos ?? []) {
      if (tarea.proyectoId && tarea.estado !== 'hecha' && tarea.estimadoMin) {
        mapa.set(tarea.proyectoId, (mapa.get(tarea.proyectoId) ?? 0) + tarea.estimadoMin);
      }
    }
    return mapa;
  }, [tareas.datos]);
  const grupos = useMemo(() => {
    const porEstado: Record<EstadoProyecto, Proyecto[]> = { activo: [], pausado: [], archivado: [] };
    for (const p of proyectos.datos ?? []) porEstado[p.estado].push(p);
    return porEstado;
  }, [proyectos.datos]);

  const cuadricula = (lista: Proyecto[]) => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {lista.map((p) => (
        <TarjetaProyecto key={p.id} proyecto={p} progreso={progreso.get(p.id) ?? SIN_PROGRESO} restanteMin={restantes.get(p.id)} />
      ))}
    </div>
  );

  const vacio = proyectos.estado === 'listo' && proyectos.datos.length === 0;

  return (
    <Pagina
      titulo={t.nav.proyectos}
      subtitulo={proyectos.datos && !vacio ? t.proyectos.subtitulo(grupos.activo.length) : undefined}
      acciones={
        !vacio && (
          <>
            <Button variante="primario" icono={<Plus className="size-4" />} onClick={nuevoProyecto} className="max-md:hidden">
              {t.acciones.nuevoProyecto}
            </Button>
            <IconButton etiqueta={t.acciones.nuevoProyecto} variante="secundario" onClick={nuevoProyecto} className="md:hidden">
              <Plus className="size-5" />
            </IconButton>
          </>
        )
      }
    >
      {vacio && (
        <EstadoVacio
          icono={FolderKanban}
          titulo={t.proyectos.vacioTitulo}
          texto={t.proyectos.vacioTexto}
          accion={
            <Button variante="primario" icono={<Plus className="size-4" />} onClick={nuevoProyecto}>
              {t.acciones.nuevoProyecto}
            </Button>
          }
        />
      )}

      {!vacio && (
        <Pestanas
          etiqueta={t.estadisticas.vistas}
          opciones={VISTAS}
          valor={vista}
          alCambiar={cambiarVista}
          className="mb-6"
          render={(v) => (v === 'proyectos' ? t.nav.proyectos : t.estadisticas.titulo)}
        />
      )}
      {vista === 'estadisticas' && !vacio && <EstadisticasProyectos ahora={ahora} />}

      {vista === 'proyectos' && grupos.activo.length > 0 && (
        <Seccion titulo={t.proyectos.activos} contador={grupos.activo.length}>
          {cuadricula(grupos.activo)}
        </Seccion>
      )}
      {vista === 'proyectos' && grupos.pausado.length > 0 && (
        <Seccion titulo={t.proyectos.pausados} contador={grupos.pausado.length}>
          {cuadricula(grupos.pausado)}
        </Seccion>
      )}
      {vista === 'proyectos' && grupos.archivado.length > 0 && (
        <section className="mb-8">
          <button
            type="button"
            aria-expanded={verArchivados}
            onClick={() => setVerArchivados((v) => !v)}
            className="mb-2 flex h-11 cursor-pointer items-center gap-2 rounded-lg px-1 text-[13px] font-semibold tracking-wide text-texto-2 uppercase hover:text-texto md:h-8"
          >
            {t.proyectos.archivados}
            <span className="font-medium text-texto-3 tabular-nums">{grupos.archivado.length}</span>
            <ChevronDown className={cn('size-4 transition-transform', verArchivados && 'rotate-180')} aria-hidden />
          </button>
          {verArchivados && <div className="animate-entrada">{cuadricula(grupos.archivado)}</div>}
        </section>
      )}
    </Pagina>
  );
}
