import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Pestañas subrayadas para alternar secciones de una vista (p. ej. Tareas / Notas). */
export function Pestanas<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  render,
  className,
}: {
  opciones: readonly T[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiqueta: string;
  render: (opcion: T) => ReactNode;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className={cn('flex gap-6 border-b border-borde', className)}>
      {opciones.map((opcion) => {
        const activa = opcion === valor;
        return (
          <button
            key={opcion}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => alCambiar(opcion)}
            className={cn(
              '-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-b-2 text-[15px] font-medium transition-colors md:h-10 md:text-sm',
              activa ? 'border-acento text-texto' : 'border-transparent text-texto-2 hover:text-texto',
            )}
          >
            {render(opcion)}
          </button>
        );
      })}
    </div>
  );
}
