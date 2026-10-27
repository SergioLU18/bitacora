import { describe, expect, it } from 'vitest';
import { compararVersiones, debeActualizar, esManifiestoValido, type ManifiestoActualizacion } from './actualizaciones';

const manifiesto: ManifiestoActualizacion = {
  build: 200,
  version: '0.1.0',
  url: 'https://example.com/bundle.zip',
  checksum: 'abc',
  nativoMinimo: '1.0',
};

describe('compararVersiones', () => {
  it('compara numéricamente cada segmento', () => {
    expect(compararVersiones('1.10', '1.9')).toBeGreaterThan(0);
    expect(compararVersiones('1.0', '1.0.0')).toBe(0);
    expect(compararVersiones('1.0', '1.1')).toBeLessThan(0);
  });
});

describe('debeActualizar', () => {
  it('actualiza solo a un build más nuevo', () => {
    expect(debeActualizar(manifiesto, 100, '1.0')).toBe(true);
    expect(debeActualizar(manifiesto, 200, '1.0')).toBe(false);
    expect(debeActualizar(manifiesto, 300, '1.0')).toBe(false);
  });

  it('no instala bundles que necesitan un binario nativo más nuevo', () => {
    expect(debeActualizar({ ...manifiesto, nativoMinimo: '1.1' }, 100, '1.0')).toBe(false);
    expect(debeActualizar({ ...manifiesto, nativoMinimo: '1.1' }, 100, '1.2')).toBe(true);
  });
});

describe('esManifiestoValido', () => {
  it('rechaza datos incompletos', () => {
    expect(esManifiestoValido(manifiesto)).toBe(true);
    expect(esManifiestoValido({ ...manifiesto, build: '200' })).toBe(false);
    expect(esManifiestoValido(null)).toBe(false);
    expect(esManifiestoValido('<html>')).toBe(false);
  });
});
