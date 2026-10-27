import { Pin, Trash } from 'lucide-react';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRepositorios } from '../../data/RepositoryContext';
import type { Nota } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { Button, IconButton } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { useAccionesNota } from './useAccionesNota';

interface Props {
  abierto: boolean;
  proyectoId: string;
  /** Sin nota: se crea una nueva. */
  original?: Nota;
  alCerrar: () => void;
}

/** Crear y editar notas de un proyecto. Basta con título o contenido. */
export function NotaSheet({ abierto, proyectoId, original, alCerrar }: Props) {
  const { t } = useI18n();
  const { notas } = useRepositorios();
  const { mostrar } = useToast();
  const acciones = useAccionesNota();
  const idForm = useId();

  const [titulo, setTitulo] = useState(original?.titulo ?? '');
  const [contenido, setContenido] = useState(original?.contenido ?? '');
  const [fijada, setFijada] = useState(original?.fijada ?? false);
  const [guardando, setGuardando] = useState(false);
  const puedeGuardar = !!(titulo.trim() || contenido.trim()) && !guardando;

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    const ok = await acciones.conError(
      original
        ? notas.actualizar(original.id, { titulo: titulo || null, contenido, fijada })
        : notas.crear({ proyectoId, titulo, contenido, fijada }),
    );
    setGuardando(false);
    if (ok) {
      mostrar({ mensaje: original ? t.notas.guardada : t.notas.creada });
      alCerrar();
    }
  };

  // En el contenido Enter hace salto de línea; ⌘/Ctrl + Enter guarda.
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void guardar();
  };

  return (
    <Sheet
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={original ? t.notas.editar : t.notas.nueva}
      pie={
        <>
          {original && (
            <Button
              variante="peligro"
              icono={<Trash className="size-4" />}
              onClick={() => {
                void acciones.eliminar(original);
                alCerrar();
              }}
              className="-ml-2"
            >
              {t.acciones.eliminar}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <IconButton
              etiqueta={fijada ? t.notas.desfijar : t.notas.fijar}
              aria-pressed={fijada}
              onClick={() => setFijada(!fijada)}
              className={fijada ? '!text-acento' : undefined}
            >
              <Pin className={cn('size-[18px]', fijada && 'fill-current')} />
            </IconButton>
            <Button onClick={alCerrar} className="max-sm:hidden">
              {t.acciones.cancelar}
            </Button>
            <Button type="submit" form={idForm} variante="primario" disabled={!puedeGuardar}>
              {original ? t.acciones.guardar : t.acciones.crear}
            </Button>
          </div>
        </>
      }
    >
      <form id={idForm} onSubmit={guardar} onKeyDown={alTeclear} className="-mx-1 flex flex-col">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={t.notas.tituloPlaceholder}
          aria-label={t.notas.titulo}
          enterKeyHint="next"
          className="w-full rounded-lg bg-transparent px-1 py-1 text-xl font-semibold tracking-tight placeholder:font-medium placeholder:text-texto-3 focus:outline-none"
        />
        <textarea
          data-autofocus
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder={t.notas.contenidoPlaceholder}
          aria-label={t.notas.contenido}
          className="mt-1 field-sizing-content min-h-56 w-full resize-none rounded-lg bg-transparent px-1 py-1 text-[16px] leading-relaxed placeholder:text-texto-3 focus:outline-none md:text-[15px]"
        />
      </form>
    </Sheet>
  );
}
