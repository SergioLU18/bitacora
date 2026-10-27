import { CalendarDays, FolderKanban, Hourglass, ListTodo, Sun, type LucideIcon } from 'lucide-react';
import type { Mensajes } from '../../i18n/es';

export interface DestinoNav {
  ruta: string;
  icono: LucideIcon;
  texto: (t: Mensajes) => string;
  /** Tecla de atajo. */
  tecla: string;
}

export const DESTINOS: readonly DestinoNav[] = [
  { ruta: '/hoy', icono: Sun, texto: (t) => t.nav.hoy, tecla: '1' },
  { ruta: '/proximos', icono: CalendarDays, texto: (t) => t.nav.proximos, tecla: '2' },
  { ruta: '/seguimiento', icono: Hourglass, texto: (t) => t.nav.seguimiento, tecla: '3' },
  { ruta: '/proyectos', icono: FolderKanban, texto: (t) => t.nav.proyectos, tecla: '4' },
  { ruta: '/todas', icono: ListTodo, texto: (t) => t.nav.todas, tecla: '5' },
];
