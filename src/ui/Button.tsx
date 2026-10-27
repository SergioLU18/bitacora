import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../lib/cn';

type Variante = 'primario' | 'secundario' | 'ghost' | 'peligro' | 'peligroSolido';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-acento text-sobre-acento hover:bg-acento-hover shadow-sm',
  secundario: 'bg-superficie text-texto border border-borde hover:bg-superficie-2 hover:border-borde-fuerte',
  ghost: 'text-texto-2 hover:bg-superficie-2 hover:text-texto',
  peligro: 'text-peligro hover:bg-peligro-suave',
  peligroSolido: 'bg-peligro text-sobre-acento hover:opacity-90 shadow-sm',
};

interface PropsButton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icono?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Botón base. Alto táctil de 44px en móvil, más compacto en escritorio. */
export function Button({ variante = 'secundario', icono, className, children, type = 'button', ...props }: PropsButton) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition-colors duration-150 select-none md:h-9 md:rounded-lg md:px-3.5 md:text-sm',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        className,
      )}
      {...props}
    >
      {icono}
      {children}
    </button>
  );
}

interface PropsIconButton extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatorio: los botones de solo icono necesitan nombre accesible. */
  etiqueta: string;
  variante?: Exclude<Variante, 'primario'> | 'primario';
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ etiqueta, variante = 'ghost', className, children, type = 'button', ...props }: PropsIconButton) {
  return (
    <button
      type={type}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors duration-150 md:size-9 md:rounded-lg',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
