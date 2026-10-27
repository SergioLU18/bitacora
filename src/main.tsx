import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Providers } from './app/providers';
import { router } from './app/router';
import { crearRepositorios } from './data/repositories';
import { BitacoraDB } from './data/repositories/dexie/db';
import { obtenerResumenPendientes } from './data/resumen';
import { ServicioSync } from './data/sync/servicio';
import { crearClienteSupabase } from './data/sync/supabase';
import { iniciarTeclado } from './lib/teclado';
import { iniciarWidget } from './lib/widget';
import './styles/index.css';

iniciarTeclado();

// Una sola base local: la usan los repositorios (la app) y la sincronización con Supabase.
const db = new BitacoraDB();
const repositorios = crearRepositorios({ db });
const sincronizacion = new ServicioSync(db, crearClienteSupabase());
sincronizacion.iniciar();
// En iOS, deja el resumen de pendientes donde lo lee el widget de la pantalla de inicio.
iniciarWidget(repositorios);

if (import.meta.env.DEV) {
  // Acceso desde la consola del navegador para probar la capa de datos: `bitacora.repos.tareas.crear({ titulo: '…' })`.
  Object.assign(window, {
    bitacora: { repos: repositorios, sync: sincronizacion, resumen: () => obtenerResumenPendientes(repositorios) },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers repositorios={repositorios} sincronizacion={sincronizacion}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
