import { Check, Plus, X } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import type { ItemChecklist } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { generarId } from '../../lib/id';
import { IconButton } from '../../ui/Button';

/** Añade `texto` como paso pendiente si no está vacío. */
export function conPasoNuevo(items: ItemChecklist[], texto: string): ItemChecklist[] {
  return texto.trim() ? [...items, { id: generarId(), texto: texto.trim(), hecho: false }] : items;
}

/**
 * Lista de pasos editable dentro del formulario de tarea. Enter en "Agregar paso" añade
 * y deja el foco listo para el siguiente; los cambios se guardan con el formulario.
 * El texto a medio escribir (`nuevo`) lo controla el formulario para no perderlo al guardar.
 */
export function EditorChecklist({
  items,
  alCambiar,
  nuevo,
  alCambiarNuevo,
}: {
  items: ItemChecklist[];
  alCambiar: (items: ItemChecklist[]) => void;
  nuevo: string;
  alCambiarNuevo: (texto: string) => void;
}) {
  const { t } = useI18n();
  const refNuevo = useRef<HTMLInputElement>(null);
  const hechos = items.filter((i) => i.hecho).length;

  const agregar = () => {
    if (!nuevo.trim()) return;
    alCambiar(conPasoNuevo(items, nuevo));
    alCambiarNuevo('');
  };
  const cambiar = (id: string, cambios: Partial<ItemChecklist>) =>
    alCambiar(items.map((i) => (i.id === id ? { ...i, ...cambios } : i)));

  // Enter nunca envía el formulario desde aquí (⌘/Ctrl + Enter sí).
  const alTeclear = (e: KeyboardEvent, accion: () => void) => {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    accion();
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-texto-2">
        {t.campos.checklist}
        {items.length > 0 && <span className="text-texto-3 tabular-nums">{`${hechos}/${items.length}`}</span>}
      </div>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.hecho}
              aria-label={t.campos.marcarPaso(item.texto)}
              onClick={() => cambiar(item.id, { hecho: !item.hecho })}
              className="-m-2 flex size-10 shrink-0 cursor-pointer items-center justify-center"
            >
              <span
                className={cn(
                  'flex size-[18px] items-center justify-center rounded-md border-2 transition-colors',
                  item.hecho ? 'border-acento bg-acento text-sobre-acento' : 'border-borde-fuerte hover:bg-superficie-2',
                )}
              >
                {item.hecho && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
              </span>
            </button>
            <input
              value={item.texto}
              aria-label={t.campos.textoPaso}
              onChange={(e) => cambiar(item.id, { texto: e.target.value })}
              onKeyDown={(e) => alTeclear(e, () => refNuevo.current?.focus())}
              className={cn(
                'h-10 min-w-0 flex-1 rounded-md bg-transparent px-1 text-[16px] focus:bg-superficie-2 focus:outline-none md:h-8 md:text-sm',
                item.hecho && 'text-texto-3 line-through decoration-texto-3',
              )}
            />
            <IconButton
              etiqueta={t.campos.quitarPaso(item.texto)}
              onClick={() => alCambiar(items.filter((i) => i.id !== item.id))}
              className="md:!size-7 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            >
              <X className="size-4" />
            </IconButton>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="-m-2 flex size-10 shrink-0 items-center justify-center text-texto-3">
            <Plus className="size-[18px]" aria-hidden />
          </span>
          <input
            ref={refNuevo}
            value={nuevo}
            onChange={(e) => alCambiarNuevo(e.target.value)}
            onKeyDown={(e) => alTeclear(e, agregar)}
            onBlur={agregar}
            placeholder={t.campos.agregarPaso}
            aria-label={t.campos.agregarPaso}
            enterKeyHint="enter"
            className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-1 text-[16px] placeholder:text-texto-3 focus:outline-none md:h-8 md:text-sm"
          />
        </li>
      </ul>
    </div>
  );
}
