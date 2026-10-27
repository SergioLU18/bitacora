import { describe, expect, it } from 'vitest';
import {
  clasificarDeadline,
  deadlineTodoElDia,
  esTodoElDia,
  estaVencida,
  rangoDelDia,
  rangoProximos,
} from './deadline';
import { compararEsperando, diasEsperando, tocaSeguimiento } from './cancha';
import { ordenarTareas } from './orden';
import { calcularProgreso, calcularProgresoPorProyecto } from './progreso';
import { generarResumenPendientes } from './resumen';
import type { Proyecto, Tarea } from './types';

// Fechas en hora local para que los tests no dependan de la zona horaria de la máquina.
const AHORA = new Date(2026, 9, 12, 10, 0); // 12 oct 2026, 10:00
const local = (dia: number, hora = 12, mes = 9) => new Date(2026, mes, dia, hora, 0).toISOString();

let contador = 0;
function tarea(datos: Partial<Tarea> = {}): Tarea {
  contador++;
  return {
    id: `t${contador}`,
    titulo: `Tarea ${contador}`,
    prioridad: 'media',
    estado: 'pendiente',
    cancha: 'mia',
    createdAt: new Date(2026, 0, 1, 0, contador).toISOString(),
    updatedAt: new Date(2026, 0, 1, 0, contador).toISOString(),
    ...datos,
  };
}

describe('clasificarDeadline', () => {
  it.each([
    [local(12, 9), 'vencida'], // hoy pero ya pasó la hora
    [local(11, 23), 'vencida'],
    [local(12, 18), 'hoy'],
    [local(13, 0), 'manana'],
    [local(13, 23), 'manana'],
    [local(19, 12), 'semana'],
    [local(20, 12), 'futuro'],
  ] as const)('%s → %s', (deadline, esperado) => {
    expect(clasificarDeadline(deadline, AHORA)).toBe(esperado);
  });
});

describe('deadline todo el día', () => {
  it('se guarda a las 23:59 locales, es "hoy" durante el día y vence al terminar', () => {
    const deadline = deadlineTodoElDia(AHORA);
    expect(esTodoElDia(deadline)).toBe(true);
    expect(esTodoElDia(local(12, 18))).toBe(false);
    expect(clasificarDeadline(deadline, AHORA)).toBe('hoy');
    expect(clasificarDeadline(deadline, new Date(2026, 9, 13, 0, 0))).toBe('vencida');
  });
});

describe('estaVencida', () => {
  it('ignora tareas hechas y sin deadline', () => {
    expect(estaVencida(tarea({ deadline: local(11) }), AHORA)).toBe(true);
    expect(estaVencida(tarea({ deadline: local(11), estado: 'hecha' }), AHORA)).toBe(false);
    expect(estaVencida(tarea(), AHORA)).toBe(false);
  });
});

describe('rangos', () => {
  it('rangoDelDia cubre el día local completo', () => {
    expect(rangoDelDia(AHORA)).toEqual({
      desde: new Date(2026, 9, 12).toISOString(),
      hasta: new Date(2026, 9, 13).toISOString(),
    });
  });

  it('rangoProximos va de mañana a 7 días después', () => {
    expect(rangoProximos(AHORA)).toEqual({
      desde: new Date(2026, 9, 13).toISOString(),
      hasta: new Date(2026, 9, 20).toISOString(),
    });
  });
});

describe('ordenarTareas', () => {
  it('ordena por deadline, luego prioridad, luego creación; sin deadline al final', () => {
    const sinFecha = tarea({ titulo: 'sin fecha', prioridad: 'alta' });
    const tardeBaja = tarea({ titulo: 'tarde', deadline: local(15) });
    const prontoBaja = tarea({ titulo: 'pronto baja', deadline: local(13), prioridad: 'baja' });
    const prontoAlta = tarea({ titulo: 'pronto alta', deadline: local(13), prioridad: 'alta' });
    const titulos = ordenarTareas([sinFecha, tardeBaja, prontoBaja, prontoAlta]).map((t) => t.titulo);
    expect(titulos).toEqual(['pronto alta', 'pronto baja', 'tarde', 'sin fecha']);
  });
});

describe('progreso', () => {
  it('calcula porcentaje redondeado y 0 % sin tareas', () => {
    expect(calcularProgreso([])).toEqual({ total: 0, hechas: 0, porcentaje: 0 });
    const lista = [tarea({ estado: 'hecha' }), tarea(), tarea()];
    expect(calcularProgreso(lista)).toEqual({ total: 3, hechas: 1, porcentaje: 33 });
  });

  it('agrupa por proyecto ignorando tareas sueltas', () => {
    const mapa = calcularProgresoPorProyecto([
      tarea({ proyectoId: 'a', estado: 'hecha' }),
      tarea({ proyectoId: 'a' }),
      tarea({ proyectoId: 'b', estado: 'hecha' }),
      tarea(),
    ]);
    expect(mapa.get('a')?.porcentaje).toBe(50);
    expect(mapa.get('b')?.porcentaje).toBe(100);
    expect(mapa.size).toBe(2);
  });
});

describe('generarResumenPendientes', () => {
  const proyecto: Proyecto = {
    id: 'p1',
    nombre: 'Casa',
    color: '#6366f1',
    estado: 'activo',
    createdAt: AHORA.toISOString(),
    updatedAt: AHORA.toISOString(),
  };

  it('clasifica pendientes y excluye hechas y eliminadas', () => {
    const resumen = generarResumenPendientes(
      [
        tarea({ titulo: 'vencida', deadline: local(10) }),
        tarea({ titulo: 'hoy', deadline: local(12, 20), proyectoId: 'p1' }),
        tarea({ titulo: 'mañana', deadline: local(13), estado: 'en_curso' }),
        tarea({ titulo: 'lejana', deadline: local(30) }),
        tarea({ titulo: 'sin fecha' }),
        tarea({ titulo: 'hecha', deadline: local(12, 20), estado: 'hecha' }),
        tarea({ titulo: 'borrada', deadline: local(12, 20), eliminadoEn: AHORA.toISOString() }),
      ],
      [proyecto],
      { ahora: AHORA },
    );

    expect(resumen.version).toBe(2);
    expect(resumen.dia).toBe('2026-10-12');
    expect(resumen.conteos).toEqual({ vencidas: 1, hoy: 1, proximos7Dias: 1, sinDeadline: 1, seguimiento: 0 });
    expect(resumen.seguimiento).toEqual([]);
    expect(resumen.hoy[0]).toMatchObject({ titulo: 'hoy', proyecto: { id: 'p1', nombre: 'Casa' } });
    expect(resumen.vencidas[0]?.titulo).toBe('vencida');
    expect(resumen.proximas[0]?.titulo).toBe('mañana');
    // Debe sobrevivir a un viaje por JSON sin perder información (lo leerá el widget).
    expect(JSON.parse(JSON.stringify(resumen))).toEqual(resumen);
  });

  it('respeta el límite por lista pero mantiene los conteos totales', () => {
    const muchas = Array.from({ length: 5 }, () => tarea({ deadline: local(12, 20) }));
    const resumen = generarResumenPendientes(muchas, [], { ahora: AHORA, limitePorLista: 2 });
    expect(resumen.hoy).toHaveLength(2);
    expect(resumen.conteos.hoy).toBe(5);
  });

  it('exporta lo que espera al cliente aunque no tenga fecha, en el orden de Seguimiento', () => {
    const resumen = generarResumenPendientes(
      [
        tarea({ titulo: 'espera sin fecha', cancha: 'cliente', esperandoDesde: local(1) }),
        tarea({ titulo: 'toca preguntar', cancha: 'cliente', esperandoDesde: local(8), seguimiento: local(12, 23) }),
        tarea({ titulo: 'con deadline hoy', cancha: 'cliente', esperandoDesde: local(10), deadline: local(12, 20) }),
        tarea({ titulo: 'mía sin fecha' }),
        tarea({ titulo: 'del cliente pero hecha', cancha: 'cliente', estado: 'hecha' }),
      ],
      [],
      { ahora: AHORA },
    );

    expect(resumen.conteos.seguimiento).toBe(3);
    expect(resumen.seguimiento.map((x) => x.titulo)).toEqual(['toca preguntar', 'espera sin fecha', 'con deadline hoy']);
    expect(resumen.seguimiento[0]).toMatchObject({ esperandoDesde: local(8), seguimiento: local(12, 23) });
    expect(resumen.seguimiento[1]?.seguimiento).toBeUndefined();
    // La tarea con deadline también sigue en su lista por fecha; el widget la pinta una sola vez.
    expect(resumen.hoy.map((x) => x.titulo)).toEqual(['con deadline hoy']);
    // Lo que no tiene deadline sigue contándose como tal, esté o no en la cancha del cliente.
    expect(resumen.conteos.sinDeadline).toBe(3);
  });
});

describe('cancha', () => {
  const enCliente = (datos: Partial<Tarea> = {}) =>
    tarea({ cancha: 'cliente', esperandoDesde: local(9, 15), ...datos });

  it('diasEsperando cuenta días naturales y solo aplica a lo pendiente del cliente', () => {
    expect(diasEsperando(enCliente(), AHORA)).toBe(3);
    expect(diasEsperando(enCliente({ esperandoDesde: local(12, 9) }), AHORA)).toBe(0);
    expect(diasEsperando(enCliente({ estado: 'hecha' }), AHORA)).toBeUndefined();
    expect(diasEsperando(tarea(), AHORA)).toBeUndefined();
  });

  it('tocaSeguimiento: hoy o antes', () => {
    expect(tocaSeguimiento(enCliente({ seguimiento: deadlineTodoElDia(AHORA) }), AHORA)).toBe(true);
    expect(tocaSeguimiento(enCliente({ seguimiento: local(10) }), AHORA)).toBe(true);
    expect(tocaSeguimiento(enCliente({ seguimiento: local(13, 0) }), AHORA)).toBe(false);
    expect(tocaSeguimiento(enCliente(), AHORA)).toBe(false);
    expect(tocaSeguimiento(enCliente({ seguimiento: local(10), estado: 'hecha' }), AHORA)).toBe(false);
  });

  it('compararEsperando: seguimiento más próximo y luego la espera más larga', () => {
    const a = enCliente({ titulo: 'a', esperandoDesde: local(1) });
    const b = enCliente({ titulo: 'b', esperandoDesde: local(5), seguimiento: local(20) });
    const c = enCliente({ titulo: 'c', esperandoDesde: local(8), seguimiento: local(14) });
    const d = enCliente({ titulo: 'd', esperandoDesde: local(3) });
    expect([a, b, c, d].sort(compararEsperando).map((x) => x.titulo)).toEqual(['c', 'b', 'a', 'd']);
  });
});
