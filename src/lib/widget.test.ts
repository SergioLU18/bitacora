import { describe, expect, it, vi } from 'vitest';
import { interpretarEnlace } from './widget';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, isPluginAvailable: () => false },
  registerPlugin: () => ({ guardarResumen: vi.fn() }),
}));

describe('interpretarEnlace', () => {
  it('abre Hoy cuando el enlace no trae destino', () => {
    expect(interpretarEnlace('bitacora://')).toEqual({ tipo: 'vista', ruta: '/hoy' });
    expect(interpretarEnlace('bitacora:///')).toEqual({ tipo: 'vista', ruta: '/hoy' });
  });

  it('reconoce las vistas principales', () => {
    expect(interpretarEnlace('bitacora://proximos')).toEqual({ tipo: 'vista', ruta: '/proximos' });
    expect(interpretarEnlace('bitacora://todas/')).toEqual({ tipo: 'vista', ruta: '/todas' });
  });

  it('abre una tarea por id', () => {
    expect(interpretarEnlace('bitacora://tarea/abc-123')).toEqual({ tipo: 'tarea', id: 'abc-123' });
    expect(interpretarEnlace('bitacora://tarea/con%20espacio')).toEqual({ tipo: 'tarea', id: 'con espacio' });
  });

  it('abre el detalle de un proyecto', () => {
    expect(interpretarEnlace('bitacora://proyectos/p1')).toEqual({ tipo: 'vista', ruta: '/proyectos/p1' });
  });

  it('ignora lo que no es de la app', () => {
    expect(interpretarEnlace('https://ejemplo.com/hoy')).toBeUndefined();
    expect(interpretarEnlace('bitacora://otra-cosa')).toBeUndefined();
    expect(interpretarEnlace('bitacora://tarea')).toBeUndefined();
    expect(interpretarEnlace('no es una url')).toBeUndefined();
  });
});
