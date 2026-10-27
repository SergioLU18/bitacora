import { Plus, Settings } from 'lucide-react';
import { NavLink } from 'react-router';
import { useProyectos } from '../../data/hooks';
import type { Conteos } from '../../data/hooks/derivados';
import { useEditorProyecto } from '../../features/proyectos/EditorProyectoProvider';
import { useEditorTarea } from '../../features/tareas/EditorTareaProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { Button, IconButton } from '../../ui/Button';
import { Kbd, PuntoColor } from '../../ui/Varios';
import { useAjustes } from '../AjustesProvider';
import { DESTINOS } from './navegacion';

const claseEnlace = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
    isActive ? 'bg-superficie-2 font-medium text-texto' : 'text-texto-2 hover:bg-superficie-2/60 hover:text-texto',
  );

/** Navegación lateral de escritorio. */
export function Sidebar({ conteos }: { conteos: Conteos | undefined }) {
  const { t } = useI18n();
  const { nuevaTarea } = useEditorTarea();
  const { nuevoProyecto } = useEditorProyecto();
  const { abrirAjustes } = useAjustes();
  const proyectos = useProyectos({ estados: ['activo', 'pausado'] });

  const insignia: Record<string, number | undefined> = {
    '/hoy': conteos ? conteos.hoy + conteos.vencidas : undefined,
    '/proximos': conteos?.proximos,
    '/seguimiento': conteos?.esperandoCliente,
    '/todas': conteos?.pendientes,
  };

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-borde bg-superficie/50 px-3 pt-5 pb-3 md:flex">
      <div className="mb-5 flex items-center gap-2.5 px-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-acento text-sobre-acento shadow-sm">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="font-titulo text-[17px] font-bold tracking-tight">{t.app.nombre}</span>
      </div>

      <Button variante="primario" onClick={() => nuevaTarea()} icono={<Plus className="size-4" />} className="mb-5 w-full justify-start">
        {t.acciones.nuevaTarea}
        <span className="ml-auto rounded bg-sobre-acento/15 px-1.5 text-[11px] font-medium">N</span>
      </Button>

      <nav aria-label={t.nav.navegacionPrincipal} className="flex flex-col gap-0.5">
        {DESTINOS.map(({ ruta, icono: Icono, texto }) => {
          const n = insignia[ruta];
          const alerta = ruta === '/hoy' && (conteos?.vencidas ?? 0) > 0;
          const aviso = ruta === '/seguimiento' && (conteos?.seguimientos ?? 0) > 0;
          return (
            <NavLink key={ruta} to={ruta} className={claseEnlace}>
              {({ isActive }) => (
                <>
                  <Icono className={cn('size-[18px]', isActive ? 'text-acento' : 'text-texto-3 group-hover:text-texto-2')} aria-hidden />
                  {texto(t)}
                  <span className="ml-auto flex items-center gap-2">
                    {n ? (
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          alerta ? 'font-semibold text-peligro' : aviso ? 'font-semibold text-aviso' : 'text-texto-3',
                        )}
                      >
                        {n}
                      </span>
                    ) : null}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-7 mb-1 flex items-center justify-between pr-1 pl-2.5">
        <h2 className="text-xs font-semibold tracking-wide text-texto-3 uppercase">{t.nav.proyectos}</h2>
        <IconButton etiqueta={t.acciones.nuevoProyecto} onClick={nuevoProyecto} className="!size-7">
          <Plus className="size-4" />
        </IconButton>
      </div>
      <nav aria-label={t.nav.proyectos} className="-mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {proyectos.datos?.map((p) => (
          <NavLink key={p.id} to={`/proyectos/${p.id}`} className={claseEnlace}>
            <PuntoColor color={p.color} className={cn('mx-[3px]', p.estado === 'pausado' && 'opacity-40')} />
            <span className="truncate">{p.nombre}</span>
            {conteos?.pendientesPorProyecto.get(p.id) ? (
              <span className="ml-auto text-xs text-texto-3 tabular-nums">{conteos.pendientesPorProyecto.get(p.id)}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={abrirAjustes}
        className="mt-2 flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-texto-2 transition-colors hover:bg-superficie-2/60 hover:text-texto"
      >
        <Settings className="size-[18px] text-texto-3" aria-hidden />
        {t.nav.ajustes}
        <span className="ml-auto">
          <Kbd>?</Kbd>
        </span>
      </button>
    </aside>
  );
}
