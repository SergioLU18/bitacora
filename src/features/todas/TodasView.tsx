import { ListTodo, Plus, SearchX } from 'lucide-react';
import { useId, useState } from 'react';
import { useProyectos, useTareas } from '../../data/hooks';
import { useMapaProyectos } from '../../data/hooks/derivados';
import type { FiltroTareas } from '../../data/repositories/types';
import { ESTADOS_TAREA, PRIORIDADES, type EstadoTarea, type Prioridad } from '../../domain/types';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../../ui/Button';
import { Chip, Select } from '../../ui/Campos';
import { Pagina } from '../../ui/Pagina';
import { EstadoVacio, ListaCargando } from '../../ui/Varios';
import { useEditorTarea } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';

const ESTADOS_POR_DEFECTO: readonly EstadoTarea[] = ['pendiente', 'en_curso'];
const SIN_PROYECTO = '__sin__';

function alternar<T>(lista: readonly T[], valor: T, minimo = 0): T[] {
  if (lista.includes(valor)) return lista.length > minimo ? lista.filter((x) => x !== valor) : [...lista];
  return [...lista, valor];
}

export function TodasView() {
  const { t } = useI18n();
  const ahora = useAhora();
  const proyectos = useMapaProyectos();
  const listaProyectos = useProyectos();
  const { nuevaTarea } = useEditorTarea();
  const idProyecto = useId();

  const [estados, setEstados] = useState<readonly EstadoTarea[]>(ESTADOS_POR_DEFECTO);
  const [prioridades, setPrioridades] = useState<readonly Prioridad[]>([]);
  const [proyecto, setProyecto] = useState('');

  const filtro: FiltroTareas = {
    // Se conserva el orden canónico para que la clave de la consulta sea estable.
    estados: ESTADOS_TAREA.filter((e) => estados.includes(e)),
    ...(prioridades.length > 0 && { prioridades: PRIORIDADES.filter((p) => prioridades.includes(p)) }),
    ...(proyecto && { proyectoId: proyecto === SIN_PROYECTO ? null : proyecto }),
  };
  const consulta = useTareas(filtro);
  const total = useTareas();

  const filtrosPorDefecto =
    estados.length === ESTADOS_POR_DEFECTO.length &&
    ESTADOS_POR_DEFECTO.every((e) => estados.includes(e)) &&
    prioridades.length === 0 &&
    !proyecto;
  const limpiar = () => {
    setEstados(ESTADOS_POR_DEFECTO);
    setPrioridades([]);
    setProyecto('');
  };

  const sinNingunaTarea = total.estado === 'listo' && total.datos.length === 0;
  const tareas = consulta.datos ?? [];

  return (
    <Pagina
      titulo={t.nav.todas}
      subtitulo={consulta.datos && !sinNingunaTarea ? t.conteos.tareas(tareas.length) : undefined}
      acciones={
        <Button variante="primario" icono={<Plus className="size-4" />} onClick={() => nuevaTarea({})} className="max-md:hidden">
          {t.acciones.nuevaTarea}
        </Button>
      }
    >
      {sinNingunaTarea ? (
        <EstadoVacio
          icono={ListTodo}
          titulo={t.todas.vacioTitulo}
          texto={t.todas.vacioTexto}
          accion={
            <Button variante="primario" icono={<Plus className="size-4" />} onClick={() => nuevaTarea({})}>
              {t.acciones.nuevaTarea}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-oculta md:mx-0 md:px-0">
              <div role="group" aria-label={t.todas.filtroEstado} className="flex shrink-0 gap-2">
                {ESTADOS_TAREA.map((e) => (
                  <Chip key={e} activo={estados.includes(e)} alCambiar={() => setEstados(alternar(estados, e, 1))}>
                    {t.estadoTarea[e]}
                  </Chip>
                ))}
              </div>
              <span aria-hidden className="my-1.5 w-px shrink-0 bg-borde" />
              <div role="group" aria-label={t.todas.filtroPrioridad} className="flex shrink-0 gap-2">
                {PRIORIDADES.map((p) => (
                  <Chip key={p} activo={prioridades.includes(p)} alCambiar={() => setPrioridades(alternar(prioridades, p))}>
                    {t.prioridad[p]}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 md:ml-auto">
              <label htmlFor={idProyecto} className="sr-only">
                {t.campos.proyecto}
              </label>
              <Select id={idProyecto} value={proyecto} onChange={(e) => setProyecto(e.target.value)} className="flex-1 md:w-52 md:flex-none">
                <option value="">{t.todas.todosLosProyectos}</option>
                <option value={SIN_PROYECTO}>{t.campos.sinProyecto}</option>
                {listaProyectos.datos?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
              {!filtrosPorDefecto && (
                <Button variante="ghost" onClick={limpiar}>
                  {t.acciones.limpiar}
                </Button>
              )}
            </div>
          </div>

          {consulta.estado === 'cargando' && <ListaCargando />}
          {consulta.estado === 'listo' && tareas.length === 0 && (
            <EstadoVacio
              icono={SearchX}
              titulo={t.todas.vacioFiltroTitulo}
              texto={t.todas.vacioFiltroTexto}
              compacto
              accion={
                !filtrosPorDefecto && (
                  <Button onClick={limpiar}>{t.todas.limpiarFiltros}</Button>
                )
              }
            />
          )}
          {tareas.length > 0 && (
            <TareaLista
              tareas={tareas}
              proyectos={proyectos}
              ahora={ahora}
              seVaAlCompletar={!estados.includes('hecha')}
            />
          )}
        </>
      )}
    </Pagina>
  );
}
