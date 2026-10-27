/** Colores disponibles para proyectos. Se guarda el hex para que sea portable (widget, Supabase). */
export const COLORES_PROYECTO = [
  '#008898', // teal (Lophex)
  '#00caed', // cian (Lophex)
  '#6366f1', // índigo
  '#22c55e', // verde
  '#eab308', // ámbar
  '#f97316', // naranja
  '#ef4444', // rojo
  '#ec4899', // rosa
  '#a855f7', // violeta
  '#64748b', // pizarra
] as const;

export const COLOR_PROYECTO_POR_DEFECTO = COLORES_PROYECTO[0];

export function esColorValido(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}
