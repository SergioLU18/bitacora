import { parseISO } from 'date-fns';
import { ArrowRight, Plus, Sun } from 'lucide-react';
import { Link } from 'react-router';
import { useTareas } from '../../data/hooks';
import { useMapaProyectos } from '../../data/hooks/derivados';
import { compararEsperando, tocaSeguimiento } from '../../domain/cancha';
import { deadlineTodoElDia, estaVencida, rangoDelDia, rangoProximos } from '../../domain/deadline';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { nombreDia, textoEncabezado } from '../../lib/fechas';
import { Button } from '../../ui/Button';
import { Pagina, Seccion } from '../../ui/Pagina';
import { EstadoVacio, ListaCargando, PuntoColor } from '../../ui/Varios';
import { useEditorTarea, usePredeterminadosCaptura } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';

export function HoyView() {
  const { t, locale } = useI18n();
  const ahora = useAhora();
  const proyectos = useMapaProyectos();
  const { nuevaTarea } = useEditorTarea();
  const { hasta } = rangoDelDia(ahora);
  const consulta = useTareas({ estados: ['pendiente', 'en_curso'], deadlineHasta: hasta });
  const delCliente = useTareas({ estados: ['pendiente', 'en_curso'], cancha: 'cliente' });

  const deadlineHoy = deadlineTodoElDia(ahora);
  usePredeterminadosCaptura({ deadline: deadlineHoy });

  const tareas = consulta.datos ?? [];
  const vencidas = tareas.filter((x) => estaVencida(x, ahora));
  const paraHoy = tareas.filter((x) => !estaVencida(x, ahora));
  // Lo que toca preguntarle al cliente hoy, sin repetir lo que ya aparece por su fecha límite.
  const yaListadas = new Set(tareas.map((x) => x.id));
  const seguimientos = (delCliente.datos ?? [])
    .filter((x) => tocaSeguimiento(x, ahora) && !yaListadas.has(x.id))
    .sort(compararEsperando);
  const agregar = () => nuevaTarea({ deadline: deadlineHoy });

  return (
    <Pagina
      titulo={t.nav.hoy}
      subtitulo={textoEncabezado(ahora, t, locale)}
      acciones={
        <Button variante="primario" icono={<Plus className="size-4" />} onClick={agregar} className="max-md:hidden">
          {t.acciones.agregarTarea}
        </Button>
      }
    >
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {consulta.estado === 'cargando' && <ListaCargando />}
          {consulta.estado === 'listo' && delCliente.estado === 'listo' && tareas.length === 0 && seguimientos.length === 0 && (
            <EstadoVacio
              icono={Sun}
              titulo={t.hoy.vacioTitulo}
              texto={t.hoy.vacioTexto}
              accion={
                <Button variante="primario" icono={<Plus className="size-4" />} onClick={agregar}>
                  {t.acciones.agregarTarea}
                </Button>
              }
            />
          )}
          {vencidas.length > 0 && (
            <Seccion titulo={t.hoy.vencidas} contador={vencidas.length} tono="peligro">
              <div className="rounded-2xl bg-peligro-suave/60 px-3 py-1">
                <TareaLista tareas={vencidas} proyectos={proyectos} ahora={ahora} seVaAlCompletar etiqueta={t.hoy.vencidas} />
              </div>
            </Seccion>
          )}
          {paraHoy.length > 0 && (
            <Seccion titulo={t.hoy.paraHoy} contador={paraHoy.length}>
              <TareaLista tareas={paraHoy} proyectos={proyectos} ahora={ahora} soloHora seVaAlCompletar etiqueta={t.hoy.paraHoy} />
            </Seccion>
          )}
          {seguimientos.length > 0 && (
            <Seccion
              titulo={t.hoy.darSeguimiento}
              contador={seguimientos.length}
              tono="aviso"
              accion={
                <Link to="/seguimiento" className="inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:text-acento-hover">
                  {t.hoy.verSeguimiento}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            >
              <TareaLista tareas={seguimientos} proyectos={proyectos} ahora={ahora} seVaAlCompletar etiqueta={t.hoy.darSeguimiento} />
            </Seccion>
          )}
        </div>
        <PanelDia ahora={ahora} vencidas={vencidas.length} hoy={paraHoy.length} />
      </div>
    </Pagina>
  );
}

/** Columna lateral en pantallas anchas: conteos del día y lo que viene. */
function PanelDia({ ahora, vencidas, hoy }: { ahora: Date; vencidas: number; hoy: number }) {
  const { t, locale } = useI18n();
  const proyectos = useMapaProyectos();
  const rango = rangoProximos(ahora);
  const proximas = useTareas({ estados: ['pendiente', 'en_curso'], deadlineDesde: rango.desde, deadlineHasta: rango.hasta });
  const lista = proximas.datos ?? [];

  const cifras = [
    { etiqueta: t.hoy.vencidas, valor: vencidas, clase: vencidas > 0 ? 'text-peligro' : undefined },
    { etiqueta: t.hoy.pendientesHoy, valor: hoy },
    { etiqueta: t.nav.proximos, valor: lista.length },
  ];

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-12 space-y-4">
        <div className="rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-texto-2 uppercase">{t.hoy.tuDia}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {cifras.map(({ etiqueta, valor, clase }) => (
              <div key={etiqueta} className="rounded-xl bg-superficie-2 px-3 py-2.5">
                <dd className={cn('text-2xl font-bold tracking-tight tabular-nums', clase)}>{valor}</dd>
                <dt className="mt-0.5 truncate text-xs text-texto-2">{etiqueta}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-borde bg-superficie p-5">
          <h2 className="text-[13px] font-semibold tracking-wide text-texto-2 uppercase">{t.hoy.proximosDias}</h2>
          {lista.length === 0 ? (
            <p className="mt-3 text-sm text-texto-3">{t.hoy.nadaProximo}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {lista.slice(0, 5).map((tarea) => {
                const proyecto = tarea.proyectoId ? proyectos.get(tarea.proyectoId) : undefined;
                return (
                  <li key={tarea.id} className="flex items-start gap-2.5 text-sm">
                    <PuntoColor color={proyecto?.color ?? 'var(--borde-fuerte)'} className="mt-1.5 size-2" />
                    <div className="min-w-0">
                      <p className="truncate">{tarea.titulo}</p>
                      <p className="text-xs text-texto-2">{nombreDia(parseISO(tarea.deadline!), ahora, t, locale)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/proximos"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-acento hover:text-acento-hover"
          >
            {t.hoy.verProximos}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}
