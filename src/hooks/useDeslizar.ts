import { useRef, useState, type PointerEvent as EventoPuntero, type MouseEvent as EventoRaton } from 'react';

interface OpcionesDeslizar {
  alDerecha?: () => void;
  alIzquierda?: () => void;
  /** Distancia en px a partir de la cual soltar dispara la acción. */
  umbral?: number;
}

/**
 * Gesto de deslizar horizontal para filas de lista (solo táctil/lápiz; con ratón hay acciones en hover).
 * El elemento debe tener `touch-action: pan-y` para que el scroll vertical siga funcionando.
 */
export function useDeslizar({ alDerecha, alIzquierda, umbral = 88 }: OpcionesDeslizar) {
  const [desplazamiento, setDesplazamiento] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const direccion = useRef<'?' | 'h' | 'v'>('?');
  const acabaDeDeslizar = useRef(false);

  const limitar = (dx: number) => {
    if (dx > 0 && !alDerecha) return 0;
    if (dx < 0 && !alIzquierda) return 0;
    // Resistencia progresiva más allá del umbral.
    const abs = Math.abs(dx);
    const amortiguado = abs <= umbral ? abs : umbral + (abs - umbral) * 0.35;
    return Math.sign(dx) * amortiguado;
  };

  const reiniciar = () => {
    inicio.current = null;
    direccion.current = '?';
    setArrastrando(false);
    setDesplazamiento(0);
  };

  const manejadores = {
    onPointerDown(e: EventoPuntero<HTMLElement>) {
      if (e.pointerType === 'mouse') return;
      inicio.current = { x: e.clientX, y: e.clientY };
      direccion.current = '?';
    },
    onPointerMove(e: EventoPuntero<HTMLElement>) {
      if (!inicio.current) return;
      const dx = e.clientX - inicio.current.x;
      const dy = e.clientY - inicio.current.y;
      if (direccion.current === '?') {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          direccion.current = 'h';
          setArrastrando(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (Math.abs(dy) > 8) {
          direccion.current = 'v';
        }
      }
      if (direccion.current === 'h') setDesplazamiento(limitar(dx));
    },
    onPointerUp() {
      if (direccion.current === 'h') {
        acabaDeDeslizar.current = true;
        if (desplazamiento >= umbral) alDerecha?.();
        else if (desplazamiento <= -umbral) alIzquierda?.();
      }
      reiniciar();
    },
    onPointerCancel: reiniciar,
    /** Evita que soltar tras deslizar se interprete como clic. */
    onClickCapture(e: EventoRaton<HTMLElement>) {
      if (acabaDeDeslizar.current) {
        e.preventDefault();
        e.stopPropagation();
        acabaDeDeslizar.current = false;
      }
    },
  };

  return {
    manejadores,
    desplazamiento,
    arrastrando,
    /** 0–1: cuánto falta para alcanzar el umbral (para animar el fondo). */
    progreso: Math.min(Math.abs(desplazamiento) / umbral, 1),
  };
}
