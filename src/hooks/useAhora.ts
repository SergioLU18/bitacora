import { useEffect, useState } from 'react';

/**
 * Hora actual que se refresca cada minuto y al volver a la app
 * (p. ej. al reabrirla al día siguiente en el móvil).
 */
export function useAhora(intervaloMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const id = window.setInterval(actualizar, intervaloMs);
    const alVolver = () => document.visibilityState === 'visible' && actualizar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [intervaloMs]);

  return ahora;
}
