import { useEffect, useState } from 'react';
import type { AlCambiar, AlError, Cancelar } from '../repositories/types';

export type EstadoConsulta<T> =
  | { estado: 'cargando'; datos: undefined; error: undefined }
  | { estado: 'listo'; datos: T; error: undefined }
  | { estado: 'error'; datos: undefined; error: unknown };

const CARGANDO = { estado: 'cargando', datos: undefined, error: undefined } as const;

/**
 * Se suscribe a un `observar*` de un repositorio y expone su último valor.
 * `clave` identifica la consulta: cuando cambia, se cancela la suscripción anterior y se crea otra.
 */
export function useSuscripcion<T>(
  clave: string,
  suscribir: (alCambiar: AlCambiar<T>, alError: AlError) => Cancelar,
): EstadoConsulta<T> {
  const [resultado, setResultado] = useState<{ clave: string; valor: EstadoConsulta<T> }>({
    clave,
    valor: CARGANDO,
  });

  useEffect(() => {
    return suscribir(
      (datos) => setResultado({ clave, valor: { estado: 'listo', datos, error: undefined } }),
      (error) => setResultado({ clave, valor: { estado: 'error', datos: undefined, error } }),
    );
    // `suscribir` cambia en cada render; la identidad de la consulta la da `clave`.
  }, [clave]);

  // Mientras llega el primer valor de una clave nueva, no se muestran datos de la anterior.
  return resultado.clave === clave ? resultado.valor : CARGANDO;
}
