import type { Archivo, EventoHistorial, Nota, Proyecto, Tarea } from '../../domain/types';
import { useRepositorios } from '../RepositoryContext';
import type { FiltroArchivos, FiltroHistorial, FiltroNotas, FiltroProyectos, FiltroTareas } from '../repositories/types';
import { useSuscripcion, type EstadoConsulta } from './useSuscripcion';

export type { EstadoConsulta } from './useSuscripcion';

/** Clave estable para un filtro: mismo contenido → misma suscripción. */
const claveDe = (prefijo: string, filtro: object) => `${prefijo}:${JSON.stringify(filtro)}`;

export function useTareas(filtro: FiltroTareas = {}): EstadoConsulta<Tarea[]> {
  const { tareas } = useRepositorios();
  return useSuscripcion(claveDe('tareas', filtro), (ok, error) => tareas.observar(filtro, ok, error));
}

export function useTarea(id: string): EstadoConsulta<Tarea | undefined> {
  const { tareas } = useRepositorios();
  return useSuscripcion(`tarea:${id}`, (ok, error) => tareas.observarUna(id, ok, error));
}

export function useProyectos(filtro: FiltroProyectos = {}): EstadoConsulta<Proyecto[]> {
  const { proyectos } = useRepositorios();
  return useSuscripcion(claveDe('proyectos', filtro), (ok, error) => proyectos.observar(filtro, ok, error));
}

export function useProyecto(id: string): EstadoConsulta<Proyecto | undefined> {
  const { proyectos } = useRepositorios();
  return useSuscripcion(`proyecto:${id}`, (ok, error) => proyectos.observarUno(id, ok, error));
}

export function useNotas(filtro: FiltroNotas = {}): EstadoConsulta<Nota[]> {
  const { notas } = useRepositorios();
  return useSuscripcion(claveDe('notas', filtro), (ok, error) => notas.observar(filtro, ok, error));
}

export function useHistorial(filtro: FiltroHistorial = {}): EstadoConsulta<EventoHistorial[]> {
  const { historial } = useRepositorios();
  return useSuscripcion(claveDe('historial', filtro), (ok, error) => historial.observar(filtro, ok, error));
}

export function useArchivos(filtro: FiltroArchivos = {}): EstadoConsulta<Archivo[]> {
  const { archivos } = useRepositorios();
  return useSuscripcion(claveDe('archivos', filtro), (ok, error) => archivos.observar(filtro, ok, error));
}
