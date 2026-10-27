import { Plus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import type { Conteos } from '../../data/hooks/derivados';
import { useEditorProyecto } from '../../features/proyectos/EditorProyectoProvider';
import { useEditorTarea } from '../../features/tareas/EditorTareaProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { DESTINOS } from './navegacion';

/** Barra de navegación inferior y botón flotante de captura rápida (móvil). */
export function BottomNav({ conteos }: { conteos: Conteos | undefined }) {
  const { t } = useI18n();
  const { nuevaTarea } = useEditorTarea();
  const { nuevoProyecto } = useEditorProyecto();
  const { pathname } = useLocation();
  // En la lista de proyectos el botón flotante crea un proyecto; en el resto, una tarea.
  const enProyectos = pathname === '/proyectos';

  return (
    <>
      <button
        type="button"
        aria-label={enProyectos ? t.acciones.nuevoProyecto : t.acciones.nuevaTarea}
        onClick={() => (enProyectos ? nuevoProyecto() : nuevaTarea())}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-30 flex size-14 cursor-pointer items-center justify-center rounded-2xl bg-acento text-sobre-acento shadow-elevada transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-6" strokeWidth={2.25} />
      </button>

      <nav
        aria-label={t.nav.navegacionPrincipal}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/85 pb-safe backdrop-blur-xl md:hidden"
      >
        <ul className="flex pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          {DESTINOS.map(({ ruta, icono: Icono, texto }) => {
            const vencidas = ruta === '/hoy' ? (conteos?.vencidas ?? 0) : 0;
            const seguimientos = ruta === '/seguimiento' ? (conteos?.seguimientos ?? 0) : 0;
            return (
              <li key={ruta} className="flex-1">
                <NavLink
                  to={ruta}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-[3.25rem] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium tracking-[-0.01em] transition-colors',
                      isActive ? 'text-acento' : 'text-texto-2',
                    )
                  }
                >
                  <span className="relative">
                    <Icono className="size-6" strokeWidth={1.75} aria-hidden />
                    {vencidas > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-peligro px-1 text-[10px] font-semibold text-sobre-acento tabular-nums">
                        <span className="sr-only">{t.conteos.vencidas(vencidas)}: </span>
                        {vencidas}
                      </span>
                    )}
                    {seguimientos > 0 && (
                      <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-aviso-borde px-1 text-[10px] font-semibold text-sobre-acento tabular-nums">
                        <span className="sr-only">{t.hoy.darSeguimiento}: </span>
                        {seguimientos}
                      </span>
                    )}
                  </span>
                  {texto(t)}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
