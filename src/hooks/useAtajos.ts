import { useEffect, useRef } from 'react';

export type MapaAtajos = Record<string, (evento: KeyboardEvent) => void>;

function esEditable(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false;
  return objetivo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(objetivo.tagName);
}

/**
 * Atajos globales de una tecla (p. ej. "n", "1", "?").
 * Se ignoran mientras se escribe en un campo, con modificadores o con un diálogo abierto.
 */
export function useAtajos(mapa: MapaAtajos): void {
  const ref = useRef(mapa);
  ref.current = mapa;

  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented || evento.metaKey || evento.ctrlKey || evento.altKey) return;
      if (esEditable(evento.target) || document.querySelector('dialog[open]')) return;
      const accion = ref.current[evento.key];
      if (accion) {
        evento.preventDefault();
        accion(evento);
      }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);
}
