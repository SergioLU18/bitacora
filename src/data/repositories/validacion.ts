import { esColorValido } from '../../domain/colores';
import { DURACION_MAXIMA_MIN } from '../../domain/tiempo';
import { ErrorValidacion } from '../../domain/errores';
import {
  CANCHAS,
  ESTADOS_PROYECTO,
  ESTADOS_TAREA,
  PRIORIDADES,
  type ItemChecklist,
  type NuevoItemChecklist,
} from '../../domain/types';

/** Validaciones compartidas por cualquier implementación de repositorio. */

export function textoRequerido(campo: string, valor: string): string {
  const limpio = valor.trim();
  if (!limpio) throw new ErrorValidacion(campo, `El campo "${campo}" es obligatorio`);
  return limpio;
}

/** Texto opcional: un string vacío se trata como ausente. */
export function textoOpcional(valor: string | null | undefined): string | undefined {
  const limpio = valor?.trim();
  return limpio ? limpio : undefined;
}

export function validarColor(color: string): string {
  if (!esColorValido(color)) throw new ErrorValidacion('color', `Color inválido: ${color}`);
  return color.toLowerCase();
}

export function validarFecha(campo: string, valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ErrorValidacion(campo, `Fecha inválida: ${valor}`);
  return fecha.toISOString();
}

function validarEnum<T extends string>(campo: string, permitidos: readonly T[], valor: T): T {
  if (!permitidos.includes(valor)) throw new ErrorValidacion(campo, `Valor inválido para "${campo}": ${valor}`);
  return valor;
}

export const validarEstadoProyecto = (v: (typeof ESTADOS_PROYECTO)[number]) =>
  validarEnum('estado', ESTADOS_PROYECTO, v);
export const validarEstadoTarea = (v: (typeof ESTADOS_TAREA)[number]) => validarEnum('estado', ESTADOS_TAREA, v);
export const validarPrioridad = (v: (typeof PRIORIDADES)[number]) => validarEnum('prioridad', PRIORIDADES, v);
export const validarCancha = (v: (typeof CANCHAS)[number]) => validarEnum('cancha', CANCHAS, v);

/** Copia `obj` sin las claves cuyo valor es `undefined` (objetos limpios para guardar/sincronizar). */
export function sinIndefinidos<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/** Duración en minutos: entero positivo dentro del límite. */
export function validarDuracion(campo: string, minutos: number): number {
  if (!Number.isInteger(minutos) || minutos <= 0 || minutos > DURACION_MAXIMA_MIN) {
    throw new ErrorValidacion(campo, `Duración inválida: ${minutos}`);
  }
  return minutos;
}

/** Limpia la checklist: descarta pasos vacíos y da id a los nuevos. Sin pasos, `undefined`. */
export function validarChecklist(
  items: readonly NuevoItemChecklist[],
  generarId: () => string,
): ItemChecklist[] | undefined {
  const lista = items.flatMap((item) => {
    const texto = item.texto.trim();
    return texto ? [{ id: item.id ?? generarId(), texto, hecho: item.hecho ?? false }] : [];
  });
  return lista.length > 0 ? lista : undefined;
}
