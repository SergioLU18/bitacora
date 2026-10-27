import { Hourglass, Plus, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTareas } from '../../data/hooks';
import { useMapaProyectos } from '../../data/hooks/derivados';
import { compararEsperando, tocaSeguimiento } from '../../domain/cancha';
import type { Cancha, Proyecto, Tarea } from '../../domain/types';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../../ui/Button';
import { Segmentado } from '../../ui/Campos';
import { Pagina, Seccion } from '../../ui/Pagina';
import { EstadoVacio, ListaCargando, PuntoColor } from '../../ui/Varios';
import { useEditorTarea, usePredeterminadosCaptura } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';

const LADOS: readonly Cancha[] = ['cliente', 'mia'];

/**
 * Qué está en la cancha de quién. "Del cliente": lo que espera respuesta, con lo que toca
 * preguntar hoy arriba. "Me toca": lo pendiente de mi lado, por proyecto y por fecha de entrega.
 */
export function SeguimientoView() {
  const { t } = useI18n();
  const ahora = useAhora();
  const proyectos = useMapaProyectos();
  const { nuevaTarea } = useEditorTarea();
  const consulta = useTareas({ estados: ['pendiente', 'en_curso'] });

  // El lado vive en la URL para conservarlo al volver atrás.
  const [params, setParams] = useSearchParams();
  const lado: Cancha = params.get('lado') === 'mia' ? 'mia' : 'cliente';
  const cambiarLado = (c: Cancha) => setParams(c === 'cliente' ? {} : { lado: c }, { replace: true });
  usePredeterminadosCaptura({ cancha: lado });

  const { delCliente, mias } = useMemo(() => {
    const todas = consulta.datos ?? [];
    return {
      delCliente: todas.filter((x) => x.cancha === 'cliente').sort(compararEsperando),
      mias: todas.filter((x) => x.cancha === 'mia'),
    };
  }, [consulta.datos]);
  const tocaHoy = delCliente.filter((x) => tocaSeguimiento(x, ahora));
  const esperando = delCliente.filter((x) => !tocaSeguimiento(x, ahora));
  const conteo: Record<Cancha, number> = { cliente: delCliente.length, mia: mias.length };

  const agregar = () => nuevaTarea({ cancha: lado });

  return (
    <Pagina
      titulo={t.nav.seguimiento}
      subtitulo={consulta.datos ? t.seguimiento.subtitulo(delCliente.length) : undefined}
      acciones={
        <Button variante="primario" icono={<Plus className="size-4" />} onClick={agregar} className="max-md:hidden">
          {t.acciones.nuevaTarea}
        </Button>
      }
    >
      <Segmentado
        etiqueta={t.seguimiento.vista}
        opciones={LADOS}
        valor={lado}
        alCambiar={cambiarLado}
        className="mb-8 sm:w-80"
        render={(c) => (
          <>
            {t.seguimiento[c]}
            <span className="text-texto-3 tabular-nums">{consulta.datos ? conteo[c] : ''}</span>
          </>
        )}
      />

      {consulta.estado === 'cargando' && <ListaCargando />}

      {consulta.estado === 'listo' && lado === 'cliente' && (
        <>
          {delCliente.length === 0 && (
            <EstadoVacio icono={Hourglass} titulo={t.seguimiento.vacioClienteTitulo} texto={t.seguimiento.vacioClienteTexto} />
          )}
          {tocaHoy.length > 0 && (
            <Seccion titulo={t.seguimiento.tocaHoy} contador={tocaHoy.length} tono="aviso">
              <div className="rounded-2xl bg-aviso-suave/60 px-3 py-1">
                <TareaLista tareas={tocaHoy} proyectos={proyectos} ahora={ahora} seVaAlCompletar etiqueta={t.seguimiento.tocaHoy} />
              </div>
            </Seccion>
          )}
          <GruposPorProyecto tareas={esperando} proyectos={proyectos} ahora={ahora} />
        </>
      )}

      {consulta.estado === 'listo' && lado === 'mia' && (
        <>
          {mias.length === 0 && (
            <EstadoVacio icono={UserRound} titulo={t.seguimiento.vacioMiaTitulo} texto={t.seguimiento.vacioMiaTexto} />
          )}
          <GruposPorProyecto tareas={mias} proyectos={proyectos} ahora={ahora} />
        </>
      )}
    </Pagina>
  );
}

/** Agrupa por proyecto conservando el orden de llegada (el primer grupo es el de la tarea más urgente). */
function GruposPorProyecto({
  tareas,
  proyectos,
  ahora,
}: {
  tareas: readonly Tarea[];
  proyectos: ReadonlyMap<string, Proyecto>;
  ahora: Date;
}) {
  const { t } = useI18n();
  const grupos = useMemo(() => {
    const mapa = new Map<string, Tarea[]>();
    for (const tarea of tareas) {
      const clave = tarea.proyectoId ?? '';
      mapa.set(clave, [...(mapa.get(clave) ?? []), tarea]);
    }
    return [...mapa];
  }, [tareas]);

  return grupos.map(([proyectoId, lista]) => {
    const proyecto = proyectos.get(proyectoId);
    const titulo = proyecto ? (
      <Link to={`/proyectos/${proyecto.id}`} className="flex min-w-0 items-center gap-2 hover:text-texto">
        <PuntoColor color={proyecto.color} className="size-2" />
        <span className="truncate">
          {proyecto.nombre}
          {proyecto.cliente && <span className="font-normal tracking-normal text-texto-3 normal-case"> · {proyecto.cliente}</span>}
        </span>
      </Link>
    ) : (
      t.campos.sinProyecto
    );
    return (
      <Seccion key={proyectoId} titulo={titulo} contador={lista.length}>
        <TareaLista tareas={lista} proyectos={proyectos} ahora={ahora} ocultarProyecto seVaAlCompletar />
      </Seccion>
    );
  });
}
