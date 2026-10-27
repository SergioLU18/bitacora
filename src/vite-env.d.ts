/// <reference types="vite/client" />

/** Número de build de la web (segundos Unix del último commit). Lo define vite.config.ts. */
declare const __BUILD_WEB__: number;
/** Versión legible de la web, p. ej. "0.1.0 (a1b2c3d)". */
declare const __VERSION_WEB__: string;

interface ImportMetaEnv {
  /** URL del manifiesto de actualizaciones en vivo (latest.json). */
  readonly VITE_URL_ACTUALIZACIONES?: string;
  /** Proyecto de Supabase para sincronizar entre dispositivos (.env). Sin él, la app funciona solo en local. */
  readonly VITE_SUPABASE_URL?: string;
  /** Clave publishable (pública) de Supabase. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
