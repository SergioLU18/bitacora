import { Undo2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AccionToast {
  texto: string;
  alHacer: () => void;
  /** Icono opcional; por defecto, el de "Deshacer". */
  icono?: ReactNode;
}

export interface Toast {
  mensaje: string;
  /** Hasta dos acciones (p. ej. "Anotar tiempo" y "Deshacer"). */
  acciones?: AccionToast[];
  tono?: 'normal' | 'error';
  /** Por defecto, 5 s (8 s con dos acciones). */
  duracionMs?: number;
}

interface ContextoToast {
  mostrar: (toast: Toast) => void;
}

const ToastContext = createContext<ContextoToast | null>(null);
const DURACION_MS = 5000;
const DURACION_CON_VARIAS_ACCIONES_MS = 8000;

/** Un solo toast a la vez: uno nuevo reemplaza al anterior (como en iOS/Android). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [actual, setActual] = useState<(Toast & { id: number }) | null>(null);
  const contador = useRef(0);

  const mostrar = useCallback((toast: Toast) => {
    setActual({ ...toast, id: ++contador.current });
  }, []);

  useEffect(() => {
    if (!actual) return;
    const duracion =
      actual.duracionMs ?? ((actual.acciones?.length ?? 0) > 1 ? DURACION_CON_VARIAS_ACCIONES_MS : DURACION_MS);
    const id = window.setTimeout(() => setActual(null), duracion);
    return () => window.clearTimeout(id);
  }, [actual]);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex justify-start pr-[calc(max(1rem,env(safe-area-inset-right))+4.5rem)] pl-[max(1rem,env(safe-area-inset-left))] md:bottom-6 md:justify-center md:px-4"
      >
        {actual && (
          <div
            key={actual.id}
            className="animate-toast pointer-events-auto flex min-h-12 max-w-lg flex-wrap items-center gap-x-1 gap-y-0.5 rounded-2xl bg-texto py-2 pr-2 pl-4 text-[15px] text-fondo shadow-elevada md:text-sm"
          >
            <span className={actual.tono === 'error' ? 'mr-2 font-medium' : 'mr-2'}>{actual.mensaje}</span>
            {actual.acciones && (
              <span className="ml-auto flex items-center">
                {actual.acciones.map((accion) => (
                  <button
                    key={accion.texto}
                    type="button"
                    onClick={() => {
                      accion.alHacer();
                      setActual(null);
                    }}
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 font-semibold whitespace-nowrap hover:bg-fondo/10 md:h-8"
                    style={{ color: 'color-mix(in oklab, var(--acento) 55%, var(--fondo))' }}
                  >
                    {accion.icono ?? <Undo2 className="size-4" aria-hidden />}
                    {accion.texto}
                  </button>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ContextoToast {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return contexto;
}
