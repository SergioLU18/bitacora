import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

const BASE =
  'w-full rounded-xl border border-borde bg-superficie px-3.5 text-[16px] text-texto placeholder:text-texto-3 transition-colors md:rounded-lg md:text-sm ' +
  'hover:border-borde-fuerte focus:border-acento focus:outline-none focus:ring-3 focus:ring-acento-suave';

/** Etiqueta + control. El texto de 16px en móvil evita el zoom automático de iOS al enfocar. */
export function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  children,
  className,
}: {
  etiqueta: string;
  htmlFor?: string;
  ayuda?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-texto-2">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-xs text-texto-2">{ayuda}</p>}
    </div>
  );
}

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(BASE, 'h-11 md:h-9', className)} {...props} />;
}

export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(BASE, 'min-h-20 resize-y py-2.5', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(BASE, 'h-11 cursor-pointer appearance-none pr-9 md:h-9')} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-texto-3"
      />
    </div>
  );
}

/** Grupo de opciones excluyentes (radio) con aspecto de control segmentado. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  className,
  render,
}: {
  opciones: readonly T[];
  valor: T;
  alCambiar: (valor: T) => void;
  etiqueta: string;
  className?: string;
  render: (opcion: T) => ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cn('flex rounded-xl bg-superficie-2 p-1 md:rounded-lg', className)}>
      {opciones.map((opcion) => {
        const activo = opcion === valor;
        return (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => alCambiar(opcion)}
            className={cn(
              'flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 whitespace-nowrap text-sm font-medium transition-all duration-150 md:h-7 md:rounded-md md:text-[13px]',
              activo ? 'bg-superficie text-texto shadow-sm' : 'text-texto-2 hover:text-texto',
            )}
          >
            {render(opcion)}
          </button>
        );
      })}
    </div>
  );
}

/** Chip conmutable para filtros. */
export function Chip({
  activo,
  alCambiar,
  children,
  className,
}: {
  activo: boolean;
  alCambiar: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alCambiar}
      className={cn(
        'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 md:h-8 md:text-[13px]',
        activo
          ? 'border-transparent bg-acento-suave text-acento'
          : 'border-borde bg-superficie text-texto-2 hover:border-borde-fuerte hover:text-texto',
        className,
      )}
    >
      {children}
    </button>
  );
}
