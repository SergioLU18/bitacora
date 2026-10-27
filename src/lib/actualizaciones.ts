import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

/**
 * Actualizaciones en vivo de la app nativa.
 *
 * La app lleva empaquetado el build web con el que se compiló (funciona sin conexión). Al abrirse y
 * al volver a primer plano consulta `latest.json`, publicado por CI en GitHub Releases; si hay un
 * bundle más nuevo y compatible con el binario instalado, lo descarga y lo deja programado para
 * aplicarse la próxima vez que la app pase a segundo plano, sin interrumpir lo que se está haciendo.
 * Mientras tanto, la interfaz ofrece aplicarlo ya (`aplicarActualizacion`).
 */

/** Manifiesto que publica `scripts/empaquetar-actualizacion.mjs`. */
export interface ManifiestoActualizacion {
  build: number;
  version: string;
  url: string;
  checksum: string;
  /** Versión nativa mínima (CFBundleShortVersionString) que necesita este bundle. */
  nativoMinimo: string;
}

const URL_MANIFIESTO =
  import.meta.env.VITE_URL_ACTUALIZACIONES ??
  'https://github.com/SergioLU18/bitacora/releases/latest/download/latest.json';

/** Compara versiones tipo "1.2.10"; devuelve <0, 0 o >0. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diferencia = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

export function esManifiestoValido(valor: unknown): valor is ManifiestoActualizacion {
  if (typeof valor !== 'object' || valor === null) return false;
  const m = valor as Record<string, unknown>;
  return (
    typeof m.build === 'number' &&
    typeof m.version === 'string' &&
    typeof m.url === 'string' &&
    typeof m.checksum === 'string' &&
    typeof m.nativoMinimo === 'string'
  );
}

/** Un bundle se instala si es más nuevo que el actual y el binario nativo lo soporta. */
export function debeActualizar(m: ManifiestoActualizacion, buildActual: number, versionNativa: string): boolean {
  return m.build > buildActual && compararVersiones(versionNativa, m.nativoMinimo) >= 0;
}

export type EstadoActualizacion =
  /** Web o desarrollo: no hay actualizaciones en vivo. */
  | { fase: 'no-disponible' }
  | { fase: 'buscando' }
  | { fase: 'al-dia'; comprobadaEn: string }
  | { fase: 'descargando' }
  /** Descargada: se aplica al pasar a segundo plano o con `aplicarActualizacion()`. */
  | { fase: 'lista'; bundleId: string }
  | { fase: 'error' };

let estado: EstadoActualizacion = { fase: 'no-disponible' };
const oyentes = new Set<(estado: EstadoActualizacion) => void>();

function fijar(siguiente: EstadoActualizacion): void {
  estado = siguiente;
  for (const oyente of oyentes) oyente(estado);
}

export const obtenerEstadoActualizacion = (): EstadoActualizacion => estado;

export function observarActualizacion(oyente: (estado: EstadoActualizacion) => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Reinicia la app con la versión descargada. */
export async function aplicarActualizacion(): Promise<void> {
  if (estado.fase !== 'lista') return;
  await CapacitorUpdater.set({ id: estado.bundleId });
}

let comprobando = false;

/** Busca y descarga una versión nueva. También se llama sola al abrir y al volver a la app. */
export async function buscarActualizacion(): Promise<void> {
  if (comprobando || estado.fase === 'no-disponible') return;
  comprobando = true;
  // Una ya descargada sigue lista mientras se vuelve a comprobar.
  const anterior = estado;
  if (anterior.fase !== 'lista' && anterior.fase !== 'buscando') fijar({ fase: 'buscando' });
  try {
    // HTTP nativo: evita CORS con las redirecciones de GitHub Releases.
    const respuesta = await CapacitorHttp.get({
      url: URL_MANIFIESTO,
      params: { t: String(Date.now()) },
      responseType: 'json',
    });
    if (respuesta.status !== 200) throw new Error(`HTTP ${respuesta.status}`);
    const datos: unknown = typeof respuesta.data === 'string' ? JSON.parse(respuesta.data) : respuesta.data;
    if (!esManifiestoValido(datos)) throw new Error('Manifiesto inválido');

    const { version: versionNativa } = await App.getInfo();
    if (!debeActualizar(datos, __BUILD_WEB__, versionNativa)) {
      fijar({ fase: 'al-dia', comprobadaEn: new Date().toISOString() });
      return;
    }

    const version = String(datos.build);
    const { bundles } = await CapacitorUpdater.list();
    const existente = bundles.find((b) => b.version === version && b.status !== 'error' && b.status !== 'deleted');
    if (existente?.status === 'downloading') {
      fijar({ fase: 'descargando' });
      return;
    }
    if (!existente) fijar({ fase: 'descargando' });
    const bundle =
      existente ?? (await CapacitorUpdater.download({ url: datos.url, version, checksum: datos.checksum }));
    await CapacitorUpdater.next({ id: bundle.id });
    fijar({ fase: 'lista', bundleId: bundle.id });
  } catch (error) {
    console.warn('[actualizaciones] no se pudo comprobar', error);
    fijar(anterior.fase === 'lista' ? anterior : { fase: 'error' });
  } finally {
    comprobando = false;
  }
}

/** Arranca las actualizaciones en vivo. No hace nada en web ni en desarrollo. */
export function iniciarActualizaciones(): void {
  if (!Capacitor.isNativePlatform()) return;
  // Confirma que este bundle arrancó bien; si no se llamara, el plugin volvería al anterior.
  void CapacitorUpdater.notifyAppReady();
  if (import.meta.env.DEV) return;

  fijar({ fase: 'buscando' });
  void buscarActualizacion();
  void App.addListener('resume', () => void buscarActualizacion());
}
