import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Estado vacío: ilustración ligera, mensaje amable y llamada a la acción. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  texto,
  accion,
  compacto,
}: {
  icono: LucideIcon;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div className={cn('animate-entrada flex flex-col items-center text-center', compacto ? 'py-10' : 'py-16 md:py-24')}>
      <div className="relative mb-5" aria-hidden>
        <div className="absolute -inset-4 rounded-full bg-acento-suave opacity-50" />
        <div className="absolute -top-3 -right-5 size-2.5 rounded-full bg-acento opacity-40" />
        <div className="absolute -bottom-2 -left-6 size-1.5 rounded-full bg-acento opacity-30" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-superficie shadow-elevada">
          <Icono className="size-7 text-acento" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      {texto && <p className="mt-1.5 max-w-xs text-[15px] text-texto-2 md:text-sm">{texto}</p>}
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  );
}

export function BarraProgreso({
  porcentaje,
  color,
  etiqueta,
  className,
}: {
  porcentaje: number;
  color: string;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={porcentaje}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
      className={cn('h-1.5 overflow-hidden rounded-full bg-superficie-2', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${porcentaje}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-borde bg-superficie-2 px-1 font-sans text-[11px] font-medium text-texto-2">
      {children}
    </kbd>
  );
}

/** Esqueleto de lista mientras cargan los datos. */
export function ListaCargando({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-1" aria-hidden>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3.5">
          <div className="size-[22px] animate-pulse rounded-full bg-superficie-2" />
          <div className="h-3.5 animate-pulse rounded bg-superficie-2" style={{ width: `${60 - i * 8}%` }} />
        </div>
      ))}
    </div>
  );
}

export function PuntoColor({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />;
}
