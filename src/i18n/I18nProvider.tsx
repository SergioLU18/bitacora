import type { Locale } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRepositorios } from '../data/RepositoryContext';
import en from './en';
import es, { type Mensajes } from './es';

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_POR_DEFECTO: Idioma = 'es';
const CLAVE_PREFERENCIA = 'idioma';

const DICCIONARIOS: Record<Idioma, { t: Mensajes; locale: Locale; nombre: string }> = {
  es: { t: es, locale: esLocale, nombre: 'Español' },
  en: { t: en, locale: enUS, nombre: 'English' },
};

interface ContextoI18n {
  idioma: Idioma;
  cambiarIdioma: (idioma: Idioma) => void;
  /** Mensajes del idioma activo: `t.nav.hoy`, `t.conteos.tareas(3)`. */
  t: Mensajes;
  /** Locale de date-fns para formatear fechas en el idioma activo. */
  locale: Locale;
}

const I18nContext = createContext<ContextoI18n | null>(null);

export function nombreIdioma(idioma: Idioma): string {
  return DICCIONARIOS[idioma].nombre;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferencias } = useRepositorios();
  const [idioma, setIdioma] = useState<Idioma | null>(null);

  // Se espera a leer la preferencia guardada para no mostrar un idioma y luego cambiarlo.
  useEffect(() => {
    let activo = true;
    preferencias
      .obtener<Idioma>(CLAVE_PREFERENCIA)
      .catch(() => undefined)
      .then((guardado) => {
        if (activo) setIdioma(guardado && IDIOMAS.includes(guardado) ? guardado : IDIOMA_POR_DEFECTO);
      });
    return () => {
      activo = false;
    };
  }, [preferencias]);

  useEffect(() => {
    if (idioma) document.documentElement.lang = idioma;
  }, [idioma]);

  const cambiarIdioma = useCallback(
    (nuevo: Idioma) => {
      setIdioma(nuevo);
      void preferencias.guardar(CLAVE_PREFERENCIA, nuevo);
    },
    [preferencias],
  );

  const valor = useMemo<ContextoI18n | null>(
    () => (idioma ? { idioma, cambiarIdioma, ...DICCIONARIOS[idioma] } : null),
    [idioma, cambiarIdioma],
  );

  if (!valor) return null;
  return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
}

export function useI18n(): ContextoI18n {
  const contexto = useContext(I18nContext);
  if (!contexto) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return contexto;
}
