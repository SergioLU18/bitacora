import { useCallback, useEffect, useState } from 'react';
import { useRepositorios } from '../RepositoryContext';

/** Preferencia local persistida (p. ej. la vista elegida en Próximos). */
export function usePreferencia<T>(clave: string, porDefecto: T): [T, (valor: T) => void] {
  const { preferencias } = useRepositorios();
  const [valor, setValor] = useState<T>(porDefecto);

  useEffect(() => {
    let activo = true;
    preferencias
      .obtener<T>(clave)
      .then((guardado) => {
        if (activo && guardado !== undefined) setValor(guardado);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [clave, preferencias]);

  const cambiar = useCallback(
    (nuevo: T) => {
      setValor(nuevo);
      void preferencias.guardar(clave, nuevo);
    },
    [clave, preferencias],
  );

  return [valor, cambiar];
}
