import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router';
import { useRepositorios } from '../data/RepositoryContext';
import { useEditorTarea } from '../features/tareas/EditorTareaProvider';
import { interpretarEnlace } from '../lib/widget';

/** La URL de lanzamiento persiste toda la sesión: se atiende una sola vez. */
let ultimoLanzamiento: string | undefined;

/**
 * Atiende los enlaces `bitacora://…` con los que iOS abre la app (p. ej. al tocar el widget):
 * tanto si la app ya estaba abierta (`appUrlOpen`) como si se lanzó con él (`getLaunchUrl`).
 */
export function useEnlacesExternos(): void {
  const navegar = useNavigate();
  const repos = useRepositorios();
  const { editarTarea } = useEditorTarea();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let activo = true;

    const seguir = async (url: string) => {
      const enlace = interpretarEnlace(url);
      console.info('[enlaces] recibido', url, enlace ? `→ ${enlace.tipo}` : '(ignorado)');
      if (!enlace || !activo) return;
      if (enlace.tipo === 'vista') {
        navegar(enlace.ruta);
        return;
      }
      navegar('/hoy');
      const tarea = await repos.tareas.obtener(enlace.id);
      if (tarea && !tarea.eliminadoEn && activo) editarTarea(tarea);
    };

    const suscripcion = (async () => {
      const { App } = await import('@capacitor/app');
      const lanzamiento = await App.getLaunchUrl();
      if (lanzamiento?.url && lanzamiento.url !== ultimoLanzamiento) {
        ultimoLanzamiento = lanzamiento.url;
        void seguir(lanzamiento.url);
      }
      return App.addListener('appUrlOpen', ({ url }) => void seguir(url));
    })();

    return () => {
      activo = false;
      void suscripcion.then((s) => s.remove());
    };
  }, [navegar, repos, editarTarea]);
}
