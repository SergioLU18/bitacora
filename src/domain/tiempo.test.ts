import { describe, expect, it } from 'vitest';
import { calcularTiempos, formatearDuracion, parsearDuracion } from './tiempo';
import type { Tarea } from './types';

describe('formatearDuracion', () => {
  it.each([
    [5, '5 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [600, '10 h'],
  ])('%i → %s', (min, texto) => expect(formatearDuracion(min)).toBe(texto));
});

describe('parsearDuracion', () => {
  it.each([
    ['45', 45],
    ['1.5', 90],
    ['1,5', 90],
    ['1:30', 90],
    ['2h', 120],
    ['2 h', 120],
    ['90 min', 90],
    ['1h 30m', 90],
    ['1h30', null], // falta la unidad de los minutos
    ['1 hora y 20 minutos', 80],
    ['1 hour and 15 minutes', 75],
    ['0.25h', 15],
    ['  ', undefined],
    ['', undefined],
    ['abc', null],
    ['2 días', null],
    ['0', null],
    ['100000', null],
  ] as const)('"%s" → %s', (texto, esperado) => expect(parsearDuracion(texto)).toBe(esperado));
});

describe('calcularTiempos', () => {
  const tarea = (datos: Partial<Tarea>): Tarea => ({
    id: Math.random().toString(),
    titulo: 'x',
    prioridad: 'media',
    estado: 'pendiente',
    cancha: 'mia',
    createdAt: '',
    updatedAt: '',
    ...datos,
  });

  it('suma estimados, pendientes y reales, y calcula la desviación con tareas comparables', () => {
    const resumen = calcularTiempos([
      tarea({ estado: 'hecha', estimadoMin: 60, realMin: 90 }),
      tarea({ estado: 'hecha', estimadoMin: 60, realMin: 60 }),
      tarea({ estado: 'hecha', realMin: 30 }), // sin estimado: no cuenta para la desviación
      tarea({ estimadoMin: 120 }),
      tarea({}),
    ]);
    expect(resumen).toEqual({ estimadoTotal: 240, estimadoPendiente: 120, realTotal: 180, desviacion: 25 });
  });

  it('sin datos comparables no hay desviación', () => {
    expect(calcularTiempos([tarea({ estimadoMin: 30 })]).desviacion).toBeUndefined();
  });
});
