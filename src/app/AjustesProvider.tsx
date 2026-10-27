import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SeccionVersion } from '../features/cuenta/SeccionVersion';
import { SeccionCuenta } from '../features/cuenta/SeccionCuenta';
import { IDIOMAS, nombreIdioma, useI18n } from '../i18n/I18nProvider';
import { Segmentado } from '../ui/Campos';
import { Sheet } from '../ui/Sheet';
import { Kbd } from '../ui/Varios';
import { DESTINOS } from './layout/navegacion';

interface ContextoAjustes {
  abrirAjustes: () => void;
}

const AjustesContext = createContext<ContextoAjustes | null>(null);

export function AjustesProvider({ children }: { children: ReactNode }) {
  const { t, idioma, cambiarIdioma } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const abrirAjustes = useCallback(() => setAbierto(true), []);
  const valor = useMemo(() => ({ abrirAjustes }), [abrirAjustes]);

  const atajos: Array<[ReactNode, string]> = [
    [<Kbd key="n">N</Kbd>, t.ajustes.atajoNueva],
    ...DESTINOS.map((d): [ReactNode, string] => [<Kbd key={d.tecla}>{d.tecla}</Kbd>, t.ajustes.atajoIr(d.texto(t))]),
    [<Kbd key="?">?</Kbd>, t.ajustes.atajoAjustes],
    [
      <span key="g" className="flex gap-1">
        <Kbd>⌘/Ctrl</Kbd>
        <Kbd>↵</Kbd>
      </span>,
      t.ajustes.atajoGuardar,
    ],
    [<Kbd key="esc">Esc</Kbd>, t.ajustes.atajoCerrar],
  ];

  return (
    <AjustesContext.Provider value={valor}>
      {children}
      <Sheet abierto={abierto} alCerrar={() => setAbierto(false)} titulo={t.ajustes.titulo}>
        <div className="flex flex-col gap-7 pb-2">
          <SeccionCuenta />
          <section>
            <h3 className="mb-2 text-[13px] font-medium text-texto-2">{t.ajustes.idioma}</h3>
            <Segmentado
              etiqueta={t.ajustes.idioma}
              opciones={IDIOMAS}
              valor={idioma}
              alCambiar={cambiarIdioma}
              render={nombreIdioma}
            />
            <p className="mt-3 text-[13px] text-texto-2">{t.ajustes.tema}</p>
          </section>
          <section className="hidden md:block">
            <h3 className="mb-2 text-[13px] font-medium text-texto-2">{t.ajustes.atajos}</h3>
            <dl className="divide-y divide-borde rounded-xl border border-borde">
              {atajos.map(([tecla, descripcion]) => (
                <div key={descripcion} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <dt>{descripcion}</dt>
                  <dd>{tecla}</dd>
                </div>
              ))}
            </dl>
          </section>
          <SeccionVersion />
        </div>
      </Sheet>
    </AjustesContext.Provider>
  );
}

export function useAjustes(): ContextoAjustes {
  const contexto = useContext(AjustesContext);
  if (!contexto) throw new Error('useAjustes debe usarse dentro de <AjustesProvider>');
  return contexto;
}
