import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { cn } from '../lib/cn';
import { IconButton } from './Button';

const DURACION_CIERRE = 200;

/**
 * Abre/cierra un <dialog> nativo con animación de salida.
 * El <dialog> modal aporta gratis: capa superior, foco atrapado, Escape y fondo inerte.
 */
function useDialogo(abierto: boolean, alCerrar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      delete dialogo.dataset.cerrando;
      dialogo.showModal();
      // React aplica autoFocus antes de showModal(); se enfoca a mano el campo marcado.
      dialogo.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      return;
    }
    if (!abierto && dialogo.open) {
      dialogo.dataset.cerrando = '';
      const id = window.setTimeout(() => {
        dialogo.close();
        delete dialogo.dataset.cerrando;
      }, DURACION_CIERRE);
      return () => window.clearTimeout(id);
    }
  }, [abierto]);

  const props = {
    ref,
    // Escape: cancelamos el cierre nativo para animarlo nosotros.
    onCancel: (e: React.SyntheticEvent) => {
      e.preventDefault();
      alCerrar();
    },
    // Clic en el fondo (el propio <dialog>, fuera del panel).
    onClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) alCerrar();
    },
  };
  return props;
}

interface PropsSheet {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  /** Barra de acciones fija al pie. */
  pie?: ReactNode;
}

/** Bottom sheet en móvil y modal centrado en escritorio. */
export function Sheet({ abierto, alCerrar, titulo, children, pie }: PropsSheet) {
  const { t } = useI18n();
  const dialogo = useDialogo(abierto, alCerrar);
  const idTitulo = useId();
  const arrastre = useArrastreParaCerrar(alCerrar);

  return (
    <dialog {...dialogo} aria-labelledby={idTitulo} className="bitacora-dialogo bitacora-sheet">
      <div
        className="bitacora-panel flex flex-col rounded-t-3xl bg-superficie shadow-elevada md:rounded-2xl"
        style={arrastre.estilo}
      >
        {/* Asa para arrastrar hacia abajo (solo móvil). */}
        <div {...arrastre.manejadores} className="flex touch-none justify-center pt-2.5 pb-1 md:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-superficie-3" />
        </div>
        <header className="flex items-center justify-between gap-3 px-5 pt-2 pb-3 md:px-6 md:pt-5">
          <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
            {titulo}
          </h2>
          <IconButton etiqueta={t.acciones.cerrar} onClick={alCerrar} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 md:px-6">{children}</div>
        {pie && (
          <footer className="flex items-center gap-2 border-t border-borde px-5 pt-3 pb-[max(0.75rem,calc(env(safe-area-inset-bottom)-var(--teclado)))] md:px-6 md:pb-4">
            {pie}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/** Arrastrar el asa hacia abajo cierra el sheet. */
function useArrastreParaCerrar(alCerrar: () => void) {
  const [dy, setDy] = useState(0);
  const inicio = useRef<number | null>(null);
  return {
    estilo: dy > 0 ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined,
    manejadores: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        inicio.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (inicio.current !== null) setDy(Math.max(0, e.clientY - inicio.current));
      },
      onPointerUp: () => {
        if (dy > 100) alCerrar();
        inicio.current = null;
        setDy(0);
      },
      onPointerCancel: () => {
        inicio.current = null;
        setDy(0);
      },
    },
  };
}

interface PropsModal {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children?: ReactNode;
  pie: ReactNode;
  className?: string;
}

/** Diálogo centrado pequeño (confirmaciones). */
export function Modal({ abierto, alCerrar, titulo, children, pie, className }: PropsModal) {
  const dialogo = useDialogo(abierto, alCerrar);
  const idTitulo = useId();
  return (
    <dialog {...dialogo} aria-labelledby={idTitulo} className="bitacora-dialogo bitacora-modal">
      <div className={cn('bitacora-panel rounded-2xl bg-superficie p-6 shadow-elevada', className)}>
        <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
          {titulo}
        </h2>
        {children && <div className="mt-2 text-[15px] text-texto-2 md:text-sm">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{pie}</div>
      </div>
    </dialog>
  );
}
