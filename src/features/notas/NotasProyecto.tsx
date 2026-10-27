import { parseISO } from 'date-fns';
import { NotebookPen, Pin, Plus } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import type { Nota } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { nombreDia } from '../../lib/fechas';
import { Button, IconButton } from '../../ui/Button';
import { EstadoVacio, ListaCargando } from '../../ui/Varios';
import { NotaSheet } from './NotaSheet';
import { useAccionesNota } from './useAccionesNota';

/** Estado del editor de notas de un proyecto: `abrir()` crea, `abrir(nota)` edita. */
export function useEditorNota(proyectoId: string): { abrir: (nota?: Nota) => void; editor: ReactNode } {
  const [estado, setEstado] = useState<{ abierto: boolean; nota?: Nota; apertura: number }>({ abierto: false, apertura: 0 });
  const abrir = useCallback((nota?: Nota) => setEstado((e) => ({ abierto: true, nota, apertura: e.apertura + 1 })), []);
  const editor = (
    <NotaSheet
      key={`nota-${estado.apertura}`}
      abierto={estado.abierto}
      proyectoId={proyectoId}
      original={estado.nota}
      alCerrar={() => setEstado((e) => ({ ...e, abierto: false }))}
    />
  );
  return { abrir, editor };
}

interface Props {
  notas: readonly Nota[] | undefined;
  ahora: Date;
  abrir: (nota?: Nota) => void;
}

export function NotasProyecto({ notas, ahora, abrir }: Props) {
  const { t } = useI18n();

  if (!notas) return <ListaCargando filas={3} />;
  if (notas.length === 0) {
    return (
      <EstadoVacio
        icono={NotebookPen}
        titulo={t.notas.vacioTitulo}
        texto={t.notas.vacioTexto}
        accion={
          <Button variante="primario" icono={<Plus className="size-4" />} onClick={() => abrir()}>
            {t.acciones.nuevaNota}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {notas.map((nota) => (
          <TarjetaNota key={nota.id} nota={nota} ahora={ahora} alAbrir={() => abrir(nota)} />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => abrir()}
        className="mt-3 flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-0.5 text-[15px] text-texto-2 transition-colors hover:text-acento md:h-10 md:text-sm"
      >
        <span className="flex size-[22px] items-center justify-center">
          <Plus className="size-[18px]" aria-hidden />
        </span>
        {t.acciones.nuevaNota}
      </button>
    </>
  );
}

function TarjetaNota({ nota, ahora, alAbrir }: { nota: Nota; ahora: Date; alAbrir: () => void }) {
  const { t, locale } = useI18n();
  const acciones = useAccionesNota();

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={alAbrir}
        className={cn(
          'flex h-full w-full cursor-pointer flex-col rounded-2xl border bg-superficie p-4 pr-11 text-left transition-colors hover:border-borde-fuerte',
          nota.fijada ? 'border-acento/40' : 'border-borde',
        )}
      >
        {nota.titulo && <h3 className="text-[15px] font-semibold tracking-tight break-words">{nota.titulo}</h3>}
        {nota.contenido && (
          <p
            className={cn(
              'line-clamp-6 text-[15px] leading-relaxed whitespace-pre-wrap break-words md:text-sm',
              nota.titulo ? 'mt-1 text-texto-2' : 'text-texto',
            )}
          >
            {nota.contenido}
          </p>
        )}
        <span className="mt-auto pt-3 text-xs text-texto-3">
          {t.notas.editada(nombreDia(parseISO(nota.updatedAt), ahora, t, locale))}
        </span>
      </button>
      <IconButton
        etiqueta={nota.fijada ? t.notas.desfijar : t.notas.fijar}
        aria-pressed={nota.fijada}
        onClick={() => void acciones.alternarFijada(nota)}
        className={cn(
          'absolute top-1.5 right-1.5 md:top-2 md:right-2 md:!size-8',
          nota.fijada
            ? '!text-acento'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:hidden',
        )}
      >
        <Pin className={cn('size-4', nota.fijada && 'fill-current')} />
      </IconButton>
    </li>
  );
}
