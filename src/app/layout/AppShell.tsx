import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useConteos } from '../../data/hooks/derivados';
import { useSincronizacion } from '../../data/sync/SincronizacionContext';
import { PantallaAcceso } from '../../features/cuenta/PantallaAcceso';
import { EditorProyectoProvider } from '../../features/proyectos/EditorProyectoProvider';
import { EditorTareaProvider, useEditorTarea } from '../../features/tareas/EditorTareaProvider';
import { useAhora } from '../../hooks/useAhora';
import { useAtajos } from '../../hooks/useAtajos';
import { useEnlacesExternos } from '../../hooks/useEnlacesExternos';
import { ConfirmarProvider } from '../../ui/Confirmar';
import { ToastProvider } from '../../ui/Toast';
import { AjustesProvider, useAjustes } from '../AjustesProvider';
import { BottomNav } from './BottomNav';
import { DESTINOS } from './navegacion';
import { Sidebar } from './Sidebar';

/** Proveedores de UI que necesitan el router (navegar tras crear, etc.). */
export function AppShell() {
  const { estado, servicio } = useSincronizacion();
  // Con Supabase configurado la app exige sesión: hasta saber si hay una guardada no se muestra nada.
  if (servicio.disponible && estado.fase === 'iniciando') return null;
  if (servicio.disponible && estado.fase === 'sin-sesion') return <PantallaAcceso />;

  return (
    <ToastProvider>
      <ConfirmarProvider>
        <AjustesProvider>
          <EditorTareaProvider>
            <EditorProyectoProvider>
              <Layout />
            </EditorProyectoProvider>
          </EditorTareaProvider>
        </AjustesProvider>
      </ConfirmarProvider>
    </ToastProvider>
  );
}

function Layout() {
  const ahora = useAhora();
  const conteos = useConteos(ahora);
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const { nuevaTarea } = useEditorTarea();
  const { abrirAjustes } = useAjustes();
  useEnlacesExternos();

  useAtajos({
    n: () => nuevaTarea(),
    N: () => nuevaTarea(),
    '?': abrirAjustes,
    ...Object.fromEntries(DESTINOS.map((d) => [d.tecla, () => navegar(d.ruta)])),
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar conteos={conteos} />
      <main className="px-safe pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+8.25rem)] md:px-10 md:pt-12 md:pb-16 xl:px-14">
        {/* La clave reinicia la animación de entrada en cada cambio de vista. */}
        <div key={pathname} className="animate-entrada">
          <Outlet />
        </div>
      </main>
      <BottomNav conteos={conteos} />
    </div>
  );
}
