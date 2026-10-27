import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { EntidadBase } from '../../domain/types';
import type { FilaRemota, RemotoArchivos, RemotoSync, TablaSync } from './tipos';

/**
 * Cliente de Supabase, o `undefined` si la app se compiló sin credenciales (tests, forks):
 * en ese caso la app funciona igual, solo en local.
 */
export function crearClienteSupabase(): SupabaseClient | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return undefined;
  return createClient(url, clave, {
    // Se entra con código, no con enlaces: no hay sesión que leer de la URL.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

/** Tablas de `supabase/migrations`: `id`, `datos` (la entidad), `updated_at`, `servidor_en`. */
export class RemotoSupabase implements RemotoSync {
  private readonly cliente: SupabaseClient;

  constructor(cliente: SupabaseClient) {
    this.cliente = cliente;
  }

  async subir(tabla: TablaSync, filas: readonly FilaRemota[]): Promise<void> {
    const { error } = await this.cliente
      .from(tabla)
      .upsert(filas.map((f) => ({ id: f.id, datos: f.datos, updated_at: f.datos.updatedAt })), { onConflict: 'id' });
    if (error) throw new Error(`Subir ${tabla}: ${error.message}`);
  }

  async bajar(tabla: TablaSync, desde: string | undefined, limite: number): Promise<FilaRemota[]> {
    let consulta = this.cliente.from(tabla).select('id, datos, servidor_en');
    if (desde) consulta = consulta.gt('servidor_en', desde);
    const { data, error } = await consulta.order('servidor_en').order('id').limit(limite);
    if (error) throw new Error(`Bajar ${tabla}: ${error.message}`);
    return (data as Array<{ id: string; datos: EntidadBase; servidor_en: string }>).map((f) => ({
      id: f.id,
      datos: f.datos,
      // Postgres responde "…+00:00"; se normaliza a ISO con Z para comparar como texto.
      servidor_en: new Date(f.servidor_en).toISOString(),
    }));
  }
}

/** Bucket privado `archivos` de `supabase/migrations`: cada cuenta solo ve su carpeta. */
export class ArchivosSupabase implements RemotoArchivos {
  private readonly cliente: SupabaseClient;

  constructor(cliente: SupabaseClient) {
    this.cliente = cliente;
  }

  async subir(ruta: string, contenido: ArrayBuffer, tipo: string | undefined): Promise<void> {
    // Se envían bytes, no un Blob: WebKit puede mandar vacío un Blob que viene de IndexedDB.
    const { error } = await this.cliente.storage
      .from('archivos')
      .upload(ruta, contenido, { upsert: true, contentType: tipo || 'application/octet-stream' });
    if (error) throw new Error(`Subir archivo: ${error.message}`);
  }

  async enlace(ruta: string, descargarComo?: string): Promise<string | undefined> {
    const { data, error } = await this.cliente.storage
      .from('archivos')
      .createSignedUrl(ruta, SEGUNDOS_ENLACE, descargarComo ? { download: descargarComo } : undefined);
    // "Object not found": otro dispositivo aún no termina de subirlo.
    if (error) return undefined;
    return data.signedUrl;
  }
}

/** Validez de los enlaces a archivos. La interfaz los renueva antes de que caduquen. */
export const SEGUNDOS_ENLACE = 60 * 60;
