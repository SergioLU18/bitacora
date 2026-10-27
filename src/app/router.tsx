import { createBrowserRouter, Navigate } from 'react-router';
import { HoyView } from '../features/hoy/HoyView';
import { ProximosView } from '../features/proximos/ProximosView';
import { ProyectoDetalleView } from '../features/proyectos/ProyectoDetalleView';
import { ProyectosView } from '../features/proyectos/ProyectosView';
import { SeguimientoView } from '../features/seguimiento/SeguimientoView';
import { TodasView } from '../features/todas/TodasView';
import { AppShell } from './layout/AppShell';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/hoy" replace /> },
      { path: 'hoy', element: <HoyView /> },
      { path: 'proximos', element: <ProximosView /> },
      { path: 'seguimiento', element: <SeguimientoView /> },
      { path: 'proyectos', element: <ProyectosView /> },
      { path: 'proyectos/:id', element: <ProyectoDetalleView /> },
      { path: 'todas', element: <TodasView /> },
      { path: '*', element: <Navigate to="/hoy" replace /> },
    ],
  },
]);
