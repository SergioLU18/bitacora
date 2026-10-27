import type { Prioridad } from '../../domain/types';
import { cn } from '../../lib/cn';

const BORDE_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'border-peligro',
  media: 'border-aviso-borde',
  baja: 'border-borde-fuerte',
};

/**
 * Casilla circular. El color del borde indica la prioridad (con texto alternativo en la fila).
 * El área táctil es de 44px aunque el círculo visible mida 22px.
 */
export function CheckTarea({
  marcada,
  prioridad,
  etiqueta,
  alCambiar,
}: {
  marcada: boolean;
  prioridad: Prioridad;
  etiqueta: string;
  alCambiar: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={etiqueta}
      onClick={alCambiar}
      className="group/check -m-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full"
    >
      <span
        className={cn(
          'flex size-[22px] items-center justify-center rounded-full border-2 transition-colors duration-200',
          marcada
            ? 'animate-check-pop border-acento bg-acento'
            : cn(BORDE_PRIORIDAD[prioridad], 'group-hover/check:bg-superficie-2'),
        )}
      >
        {marcada ? (
          <svg viewBox="0 0 16 16" className="size-3.5 text-sobre-acento" aria-hidden>
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-trazo"
            />
          </svg>
        ) : (
          // Vista previa del check al pasar el cursor (escritorio).
          <svg viewBox="0 0 16 16" className="size-3.5 text-texto-3 opacity-0 transition-opacity group-hover/check:opacity-100" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
