import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Cancha, FechaISO, Prioridad, Tarea } from '../../domain/types';
import { TareaSheet } from './TareaSheet';
import { TiempoRealModal } from './TiempoRealModal';

/** Valores con los que se precarga una tarea nueva. */
export interface Predeterminados {
  deadline?: FechaISO;
  proyectoId?: string;
  prioridad?: Prioridad;
  cancha?: Cancha;
}

interface ContextoEditor {
  /** Abre la captura rápida. Sin argumentos usa los predeterminados de la vista actual. */
  nuevaTarea: (predeterminados?: Predeterminados) => void;
  editarTarea: (tarea: Tarea) => void;
  /** Las vistas registran sus predeterminados (p. ej. "Hoy" → deadline hoy). */
  fijarPredeterminados: (predeterminados: Predeterminados | undefined) => void;
  /** Pregunta cuánto tardó una tarea y guarda su tiempo real. */
  registrarTiempo: (tarea: Tarea) => void;
}

export type ModoEditor = { tipo: 'nueva'; predeterminados: Predeterminados } | { tipo: 'editar'; tarea: Tarea };

const EditorTareaContext = createContext<ContextoEditor | null>(null);

export function EditorTareaProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<ModoEditor>({ tipo: 'nueva', predeterminados: {} });
  // Cambia en cada apertura para reiniciar el formulario.
  const [apertura, setApertura] = useState(0);
  const predeterminadosVista = useRef<Predeterminados | undefined>(undefined);

  const nuevaTarea = useCallback((predeterminados?: Predeterminados) => {
    setModo({ tipo: 'nueva', predeterminados: predeterminados ?? predeterminadosVista.current ?? {} });
    setApertura((n) => n + 1);
    setAbierto(true);
  }, []);

  const editarTarea = useCallback((tarea: Tarea) => {
    setModo({ tipo: 'editar', tarea });
    setApertura((n) => n + 1);
    setAbierto(true);
  }, []);

  const [registro, setRegistro] = useState<{ tarea?: Tarea; abierto: boolean; apertura: number }>({
    abierto: false,
    apertura: 0,
  });
  const registrarTiempo = useCallback((tarea: Tarea) => {
    setRegistro((r) => ({ tarea, abierto: true, apertura: r.apertura + 1 }));
  }, []);

  const fijarPredeterminados = useCallback((p: Predeterminados | undefined) => {
    predeterminadosVista.current = p;
  }, []);

  const valor = useMemo(
    () => ({ nuevaTarea, editarTarea, fijarPredeterminados, registrarTiempo }),
    [nuevaTarea, editarTarea, fijarPredeterminados, registrarTiempo],
  );

  return (
    <EditorTareaContext.Provider value={valor}>
      {children}
      <TareaSheet key={apertura} abierto={abierto} modo={modo} alCerrar={() => setAbierto(false)} />
      <TiempoRealModal
        key={`tiempo-${registro.apertura}`}
        tarea={registro.tarea}
        abierto={registro.abierto}
        alCerrar={() => setRegistro((r) => ({ ...r, abierto: false }))}
      />
    </EditorTareaContext.Provider>
  );
}

export function useEditorTarea(): ContextoEditor {
  const contexto = useContext(EditorTareaContext);
  if (!contexto) throw new Error('useEditorTarea debe usarse dentro de <EditorTareaProvider>');
  return contexto;
}

/** Registra los valores por defecto de la captura rápida mientras la vista está montada. */
export function usePredeterminadosCaptura(predeterminados: Predeterminados): void {
  const { fijarPredeterminados } = useEditorTarea();
  const clave = JSON.stringify(predeterminados);
  useEffect(() => {
    fijarPredeterminados(JSON.parse(clave) as Predeterminados);
    return () => fijarPredeterminados(undefined);
  }, [clave, fijarPredeterminados]);
}
