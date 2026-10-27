import { describe, expect, it } from 'vitest';
import { calcularEstadisticaProyecto, entregaProbable, entregaProbableDe, resumirEstadisticas } from './estadisticas';
import { diasEsperandoCliente } from './historial';
import type { DetalleEvento, EventoHistorial, Proyecto, Tarea } from './types';

const dia = (d: number, h = 12) => new Date(2026, 9, d, h, 0).toISOString();

let n = 0;
const evento = (fecha: string, detalle: DetalleEvento): EventoHistorial => ({
  id: `e${++n}`,
  proyectoId: 'p',
  detalle,
  createdAt: fecha,
  updatedAt: fecha,
});
const proyecto = (datos: Partial<Proyecto> = {}): Proyecto => ({
  id: `p${++n}`,
  nombre: 'P',
  color: '#000000',
  estado: 'activo',
  createdAt: dia(1),
  updatedAt: dia(1),
  ...datos,
});
const tarea = (datos: Partial<Tarea> = {}): Tarea => ({
  id: `t${++n}`,
  titulo: 'T',
  prioridad: 'media',
  estado: 'pendiente',
  cancha: 'mia',
  createdAt: dia(1),
  updatedAt: dia(1),
  ...datos,
});

describe('diasEsperandoCliente', () => {
  it('une tramos solapados y cierra al volver, completar o eliminar', () => {
    const eventos = [
      evento(dia(1), { tipo: 'tarea_creada', tareaId: 'a', titulo: 'A', cancha: 'cliente' }),
      evento(dia(2), { tipo: 'cancha', tareaId: 'b', titulo: 'B', a: 'cliente' }),
      evento(dia(4), { tipo: 'cancha', tareaId: 'a', titulo: 'A', a: 'mia' }), // a: días 1–4
      evento(dia(5), { tipo: 'tarea_completada', tareaId: 'b', titulo: 'B' }), // b: días 2–5 → unión 1–5
      evento(dia(8), { tipo: 'cancha', tareaId: 'c', titulo: 'C', a: 'cliente' }),
      evento(dia(9), { tipo: 'tarea_eliminada', tareaId: 'c', titulo: 'C' }), // c: 8–9
    ];
    expect(diasEsperandoCliente(eventos, [], new Date(2026, 9, 20))).toBe(5);
  });

  it('cuenta hasta `hasta` lo que sigue esperando, incluidas tareas anteriores al historial', () => {
    const antigua = tarea({ cancha: 'cliente', esperandoDesde: dia(3) });
    expect(diasEsperandoCliente([], [antigua], new Date(2026, 9, 6, 12))).toBe(3);
  });
});

describe('estadísticas de entrega', () => {
  const entregado = (inicio: number, estimada: number, real: number, extra: Partial<Proyecto> = {}) =>
    calcularEstadisticaProyecto(
      proyecto({ inicio: dia(inicio), entregaEstimada: dia(estimada, 23), entregaEstimadaInicial: dia(estimada, 23), entregadoEn: dia(real, 18), ...extra }),
      [],
      [],
    );

  it('mide días, factor, puntualidad y re-estimaciones', () => {
    const e = calcularEstadisticaProyecto(
      proyecto({ inicio: dia(1), entregaEstimadaInicial: dia(11, 23), entregaEstimada: dia(16, 23), entregadoEn: dia(14) }),
      [],
      [evento(dia(5), { tipo: 'entrega_estimada', de: dia(11, 23), a: dia(16, 23) }), evento(dia(6), { tipo: 'cambio', texto: 'x' })],
    );
    expect(e).toMatchObject({ diasEstimados: 10, diasTranscurridos: 13, factor: 1.3, aTiempo: true, reestimaciones: 1, cambios: 1 });
  });

  it('en curso: días restantes y sin factor', () => {
    const e = calcularEstadisticaProyecto(proyecto({ inicio: dia(1), entregaEstimada: dia(20, 23) }), [], [], new Date(2026, 9, 15, 9));
    expect(e).toMatchObject({ entregado: false, diasRestantes: 5, diasTranscurridos: 14 });
    expect(e.factor).toBeUndefined();
  });

  it('resume con mediana de factores y % a tiempo', () => {
    const lista = [entregado(1, 11, 11), entregado(1, 11, 16), entregado(1, 11, 31), calcularEstadisticaProyecto(proyecto(), [], [])];
    const tareas = [tarea({ estimadoMin: 60, realMin: 90 })];
    expect(resumirEstadisticas(lista, tareas)).toMatchObject({
      entregados: 3,
      conEstimacion: 3,
      factor: 1.5,
      aTiempoPorcentaje: 33,
      desviacionTareas: 50,
    });
    expect(resumirEstadisticas([], [])).toEqual({ entregados: 0, conEstimacion: 0 });
  });

  it('entregaProbable escala la duración estimada por el factor', () => {
    expect(entregaProbable(dia(1), dia(11, 23), 1.5)).toBe(new Date(2026, 9, 16, 23, 59).toISOString());
  });

  it('entregaProbableDe parte de la estimación original y calla si no aplica', () => {
    const p = proyecto({ inicio: dia(1), entregaEstimadaInicial: dia(11, 23), entregaEstimada: dia(20, 23) });
    expect(entregaProbableDe(p, 1.5)).toBe(new Date(2026, 9, 16, 23, 59).toISOString());
    expect(entregaProbableDe(p, 1.02)).toBeUndefined();
    expect(entregaProbableDe({ ...p, entregadoEn: dia(15) }, 1.5)).toBeUndefined();
    expect(entregaProbableDe(proyecto(), 1.5)).toBeUndefined();
  });
});
