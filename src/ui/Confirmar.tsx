import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Button } from './Button';
import { Modal } from './Sheet';

export interface OpcionesConfirmar {
  titulo: string;
  mensaje?: string;
  textoConfirmar: string;
  peligro?: boolean;
  /** Casilla opcional (p. ej. "Eliminar también sus tareas"). */
  casilla?: { etiqueta: string; ayuda?: string; valorInicial: boolean };
}

export interface ResultadoConfirmar {
  confirmado: boolean;
  casilla: boolean;
}

type Confirmar = (opciones: OpcionesConfirmar) => Promise<ResultadoConfirmar>;

const ConfirmarContext = createContext<Confirmar | null>(null);

/** Confirmaciones como promesa: `const { confirmado } = await confirmar({...})`. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [casilla, setCasilla] = useState(false);
  const resolver = useRef<(r: ResultadoConfirmar) => void>(() => {});
  const idCasilla = useId();

  const confirmar = useCallback<Confirmar>((nuevas) => {
    setOpciones(nuevas);
    setCasilla(nuevas.casilla?.valorInicial ?? false);
    setAbierto(true);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const terminar = (confirmado: boolean) => {
    setAbierto(false);
    resolver.current({ confirmado, casilla });
  };

  const valor = useMemo(() => confirmar, [confirmar]);

  return (
    <ConfirmarContext.Provider value={valor}>
      {children}
      <Modal
        abierto={abierto}
        alCerrar={() => terminar(false)}
        titulo={opciones?.titulo ?? ''}
        pie={
          <>
            <Button onClick={() => terminar(false)}>{t.acciones.cancelar}</Button>
            <Button
              variante={opciones?.peligro ? 'peligroSolido' : 'primario'}
              onClick={() => terminar(true)}
              data-autofocus
            >
              {opciones?.textoConfirmar}
            </Button>
          </>
        }
      >
        {opciones?.mensaje && <p>{opciones.mensaje}</p>}
        {opciones?.casilla && (
          <label htmlFor={idCasilla} className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-superficie-2 p-3">
            <input
              id={idCasilla}
              type="checkbox"
              checked={casilla}
              onChange={(e) => setCasilla(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--peligro)]"
            />
            <span>
              <span className="block font-medium text-texto">{opciones.casilla.etiqueta}</span>
              {opciones.casilla.ayuda && <span className="mt-0.5 block text-[13px]">{opciones.casilla.ayuda}</span>}
            </span>
          </label>
        )}
      </Modal>
    </ConfirmarContext.Provider>
  );
}

export function useConfirmar(): Confirmar {
  const contexto = useContext(ConfirmarContext);
  if (!contexto) throw new Error('useConfirmar debe usarse dentro de <ConfirmarProvider>');
  return contexto;
}
