import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simula la app nativa: el manifiesto publicado, el binario instalado y el plugin de actualizaciones.
const nativo = vi.hoisted(() => ({
  manifiesto: { status: 200, data: {} as unknown },
  bundles: [] as Array<{ id: string; version: string; status: string }>,
  descargar: vi.fn(),
  siguiente: vi.fn(),
  aplicar: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { get: async () => nativo.manifiesto },
}));
vi.mock('@capacitor/app', () => ({
  App: { getInfo: async () => ({ version: '1.0' }), addListener: async () => ({ remove() {} }) },
}));
vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: async () => {},
    list: async () => ({ bundles: nativo.bundles }),
    download: nativo.descargar,
    next: nativo.siguiente,
    set: nativo.aplicar,
  },
}));

const manifiesto = (build: number) => ({
  build,
  version: '0.1.0',
  url: 'https://example.com/bundle.zip',
  checksum: 'abc',
  nativoMinimo: '1.0',
});

/** Carga el módulo desde cero (su estado es global) como lo haría la app al arrancar. */
async function arrancar() {
  vi.resetModules();
  vi.stubEnv('DEV', false);
  const modulo = await import('./actualizaciones');
  const fases: string[] = [];
  modulo.observarActualizacion((e) => fases.push(e.fase));
  modulo.iniciarActualizaciones();
  await vi.waitFor(() => expect(['buscando', 'descargando']).not.toContain(modulo.obtenerEstadoActualizacion().fase));
  return { ...modulo, fases };
}

beforeEach(() => {
  nativo.bundles = [];
  nativo.descargar.mockReset().mockResolvedValue({ id: 'b1' });
  nativo.siguiente.mockReset().mockResolvedValue({});
  nativo.aplicar.mockReset().mockResolvedValue(undefined);
});

describe('actualizaciones en vivo', () => {
  it('descarga la versión nueva, la deja lista y la aplica a petición', async () => {
    nativo.manifiesto = { status: 200, data: manifiesto(__BUILD_WEB__ + 1) };
    const app = await arrancar();
    expect(app.obtenerEstadoActualizacion()).toEqual({ fase: 'lista', bundleId: 'b1' });
    expect(app.fases).toEqual(['buscando', 'descargando', 'lista']);
    // Programada para la próxima vez que la app pase a segundo plano…
    expect(nativo.siguiente).toHaveBeenCalledWith({ id: 'b1' });
    // …o ya mismo.
    await app.aplicarActualizacion();
    expect(nativo.aplicar).toHaveBeenCalledWith({ id: 'b1' });
  });

  it('sin versión nueva queda al día y no descarga nada', async () => {
    nativo.manifiesto = { status: 200, data: manifiesto(__BUILD_WEB__) };
    const app = await arrancar();
    expect(app.obtenerEstadoActualizacion().fase).toBe('al-dia');
    expect(nativo.descargar).not.toHaveBeenCalled();
    await app.aplicarActualizacion();
    expect(nativo.aplicar).not.toHaveBeenCalled();
  });

  it('reutiliza una descarga anterior y, si falla una comprobación, sigue lista', async () => {
    nativo.manifiesto = { status: 200, data: manifiesto(__BUILD_WEB__ + 1) };
    nativo.bundles = [{ id: 'previo', version: String(__BUILD_WEB__ + 1), status: 'pending' }];
    const app = await arrancar();
    expect(nativo.descargar).not.toHaveBeenCalled();
    expect(app.obtenerEstadoActualizacion()).toEqual({ fase: 'lista', bundleId: 'previo' });

    nativo.manifiesto = { status: 500, data: '' };
    await app.buscarActualizacion();
    expect(app.obtenerEstadoActualizacion()).toEqual({ fase: 'lista', bundleId: 'previo' });
  });

  it('un error de red se muestra como error', async () => {
    nativo.manifiesto = { status: 404, data: '' };
    const app = await arrancar();
    expect(app.obtenerEstadoActualizacion().fase).toBe('error');
  });
});
