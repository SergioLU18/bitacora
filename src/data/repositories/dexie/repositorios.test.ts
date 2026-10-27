import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ErrorNoEncontrado, ErrorValidacion } from '../../../domain/errores';
import { obtenerResumenPendientes } from '../../resumen';
import { crearRepositorios } from '../index';
import type { Repositorios } from '../types';

let repos: Repositorios;
let reloj: Date;
let numeroDB = 0;

/** Avanza el reloj simulado para comprobar `updatedAt`. */
const avanzar = (minutos = 1) => {
  reloj = new Date(reloj.getTime() + minutos * 60_000);
};

beforeEach(() => {
  reloj = new Date(2026, 9, 12, 10, 0);
  repos = crearRepositorios({ nombreDB: `bitacora-test-${++numeroDB}`, ahora: () => reloj });
});

describe('ProyectoRepository', () => {
  it('crea con valores por defecto, UUID y timestamps', async () => {
    const p = await repos.proyectos.crear({ nombre: '  Casa  ' });
    expect(p.nombre).toBe('Casa');
    expect(p.estado).toBe('activo');
    expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.createdAt).toBe(reloj.toISOString());
    expect(p.updatedAt).toBe(p.createdAt);
    expect(p).not.toHaveProperty('descripcion');
  });

  it('valida nombre y color', async () => {
    await expect(repos.proyectos.crear({ nombre: '   ' })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(repos.proyectos.crear({ nombre: 'X', color: 'rojo' })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('actualiza, borra campos con null y archiva', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa', descripcion: 'Reformas', cliente: ' Ana ' });
    expect(p.cliente).toBe('Ana');
    avanzar();
    const editado = await repos.proyectos.actualizar(p.id, { nombre: 'Hogar', descripcion: null, cliente: null });
    expect(editado).not.toHaveProperty('cliente');
    expect(editado.nombre).toBe('Hogar');
    expect(editado).not.toHaveProperty('descripcion');
    expect(editado.updatedAt).toBe(reloj.toISOString());
    expect(editado.createdAt).toBe(p.createdAt);

    const archivado = await repos.proyectos.archivar(p.id);
    expect(archivado.estado).toBe('archivado');
    expect(await repos.proyectos.listar({ estados: ['activo'] })).toHaveLength(0);
  });

  it('lista ordenado por nombre', async () => {
    await repos.proyectos.crear({ nombre: 'zeta' });
    await repos.proyectos.crear({ nombre: 'Álamo' });
    await repos.proyectos.crear({ nombre: 'beta' });
    expect((await repos.proyectos.listar()).map((p) => p.nombre)).toEqual(['Álamo', 'beta', 'zeta']);
  });

  it('eliminar hace borrado lógico y elimina sus tareas', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa' });
    const t = await repos.tareas.crear({ titulo: 'Pintar', proyectoId: p.id });
    await repos.tareas.crear({ titulo: 'Suelta' });

    await repos.proyectos.eliminar(p.id);

    expect(await repos.proyectos.obtener(p.id)).toBeUndefined();
    expect(await repos.proyectos.listar()).toHaveLength(0);
    expect(await repos.tareas.obtener(t.id)).toBeUndefined();
    expect((await repos.tareas.listar()).map((x) => x.titulo)).toEqual(['Suelta']);
    await expect(repos.proyectos.actualizar(p.id, { nombre: 'X' })).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('eliminar con "desasignar" conserva las tareas como sueltas', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa' });
    const t = await repos.tareas.crear({ titulo: 'Pintar', proyectoId: p.id });
    await repos.proyectos.eliminar(p.id, 'desasignar');
    const tarea = await repos.tareas.obtener(t.id);
    expect(tarea).toBeDefined();
    expect(tarea).not.toHaveProperty('proyectoId');
  });
});

describe('TareaRepository', () => {
  it('crea con solo el título (captura rápida)', async () => {
    const t = await repos.tareas.crear({ titulo: 'Llamar al dentista' });
    expect(t).toMatchObject({ titulo: 'Llamar al dentista', prioridad: 'media', estado: 'pendiente' });
    expect(t).not.toHaveProperty('completadaEn');
    expect(t).not.toHaveProperty('proyectoId');
  });

  it('rechaza títulos vacíos y proyectos inexistentes', async () => {
    await expect(repos.tareas.crear({ titulo: '' })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(repos.tareas.crear({ titulo: 'X', proyectoId: 'no-existe' })).rejects.toBeInstanceOf(
      ErrorValidacion,
    );
  });

  it('normaliza el deadline a ISO UTC', async () => {
    const t = await repos.tareas.crear({ titulo: 'X', deadline: '2026-10-12T18:00:00-06:00' });
    expect(t.deadline).toBe('2026-10-13T00:00:00.000Z');
  });

  it('cambiarEstado mantiene completadaEn coherente (deshacer incluido)', async () => {
    const t = await repos.tareas.crear({ titulo: 'X' });
    avanzar();
    const hecha = await repos.tareas.cambiarEstado(t.id, 'hecha');
    expect(hecha.completadaEn).toBe(reloj.toISOString());

    avanzar();
    const otraVez = await repos.tareas.cambiarEstado(t.id, 'hecha');
    expect(otraVez.completadaEn).toBe(hecha.completadaEn); // no se pisa

    const deshecha = await repos.tareas.cambiarEstado(t.id, 'pendiente');
    expect(deshecha).not.toHaveProperty('completadaEn');
    expect(deshecha.estado).toBe('pendiente');
  });

  it('actualiza y borra campos opcionales con null', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa' });
    const t = await repos.tareas.crear({ titulo: 'X', notas: 'n', proyectoId: p.id, deadline: reloj.toISOString() });
    const editada = await repos.tareas.actualizar(t.id, { notas: null, proyectoId: null, deadline: null });
    expect(editada).not.toHaveProperty('notas');
    expect(editada).not.toHaveProperty('proyectoId');
    expect(editada).not.toHaveProperty('deadline');
  });

  it('guarda, valida y borra los tiempos estimado y real', async () => {
    const t = await repos.tareas.crear({ titulo: 'X', estimadoMin: 90 });
    expect(t.estimadoMin).toBe(90);
    expect(t).not.toHaveProperty('realMin');
    const hecha = await repos.tareas.actualizar(t.id, { estado: 'hecha', realMin: 120 });
    expect(hecha).toMatchObject({ estimadoMin: 90, realMin: 120 });
    const sinEstimado = await repos.tareas.actualizar(t.id, { estimadoMin: null });
    expect(sinEstimado).not.toHaveProperty('estimadoMin');
    await expect(repos.tareas.actualizar(t.id, { realMin: 0 })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(repos.tareas.crear({ titulo: 'Y', estimadoMin: 1.5 })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('eliminar y restaurar (deshacer)', async () => {
    const t = await repos.tareas.crear({ titulo: 'X' });
    await repos.tareas.eliminar(t.id);
    expect(await repos.tareas.obtener(t.id)).toBeUndefined();
    const restaurada = await repos.tareas.restaurar(t.id);
    expect(restaurada).not.toHaveProperty('eliminadoEn');
    expect(await repos.tareas.obtener(t.id)).toBeDefined();
  });

  it('filtra por estado, prioridad, proyecto, sueltas y rango de deadline', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa' });
    const hoy = new Date(2026, 9, 12, 18).toISOString();
    const manana = new Date(2026, 9, 13, 18).toISOString();
    await repos.tareas.crear({ titulo: 'a', proyectoId: p.id, deadline: hoy, prioridad: 'alta' });
    await repos.tareas.crear({ titulo: 'b', deadline: manana, estado: 'hecha' });
    await repos.tareas.crear({ titulo: 'c', prioridad: 'baja' });

    const titulos = async (filtro: Parameters<typeof repos.tareas.listar>[0]) =>
      (await repos.tareas.listar(filtro)).map((t) => t.titulo);

    expect(await titulos({})).toEqual(['a', 'b', 'c']);
    expect(await titulos({ estados: ['hecha'] })).toEqual(['b']);
    expect(await titulos({ prioridades: ['alta', 'baja'] })).toEqual(['a', 'c']);
    expect(await titulos({ proyectoId: p.id })).toEqual(['a']);
    expect(await titulos({ proyectoId: null })).toEqual(['b', 'c']);
    expect(
      await titulos({
        deadlineDesde: new Date(2026, 9, 12).toISOString(),
        deadlineHasta: new Date(2026, 9, 13).toISOString(),
      }),
    ).toEqual(['a']);
  });

  it('observar emite al cambiar los datos y deja de emitir al cancelar', async () => {
    const emisiones: string[][] = [];
    let resolver: () => void = () => {};
    let esperadas = 0;
    const esperar = (n: number) =>
      new Promise<void>((r) => {
        esperadas = n;
        resolver = r;
        if (emisiones.length >= n) r();
      });

    const cancelar = repos.tareas.observar({ estados: ['pendiente'] }, (tareas) => {
      emisiones.push(tareas.map((t) => t.titulo));
      if (emisiones.length >= esperadas) resolver();
    });

    await esperar(1);
    expect(emisiones[0]).toEqual([]);

    const t = await repos.tareas.crear({ titulo: 'Nueva' });
    await esperar(2);
    expect(emisiones[1]).toEqual(['Nueva']);

    await repos.tareas.cambiarEstado(t.id, 'hecha');
    await esperar(3);
    expect(emisiones[2]).toEqual([]);

    cancelar();
    await repos.tareas.crear({ titulo: 'Ignorada' });
    await new Promise((r) => setTimeout(r, 50));
    expect(emisiones).toHaveLength(3);
  });

  it('la cancha del cliente anota la espera y se limpia al volver', async () => {
    const t = await repos.tareas.crear({ titulo: 'Logo' });
    expect(t.cancha).toBe('mia');
    expect(t).not.toHaveProperty('esperandoDesde');

    avanzar(60);
    const seguimiento = new Date(2026, 9, 14, 23, 59).toISOString();
    const enCliente = await repos.tareas.actualizar(t.id, { cancha: 'cliente', seguimiento });
    expect(enCliente).toMatchObject({ cancha: 'cliente', esperandoDesde: reloj.toISOString(), seguimiento });

    // Cambiar otra cosa no reinicia la espera.
    avanzar(60);
    const editada = await repos.tareas.actualizar(t.id, { titulo: 'Logo final' });
    expect(editada.esperandoDesde).toBe(enCliente.esperandoDesde);

    const deVuelta = await repos.tareas.actualizar(t.id, { cancha: 'mia', seguimiento });
    expect(deVuelta.cancha).toBe('mia');
    expect(deVuelta).not.toHaveProperty('esperandoDesde');
    expect(deVuelta).not.toHaveProperty('seguimiento');

    // Deshacer puede restaurar la fecha original de espera.
    const restaurada = await repos.tareas.actualizar(t.id, { cancha: 'cliente', esperandoDesde: enCliente.esperandoDesde });
    expect(restaurada.esperandoDesde).toBe(enCliente.esperandoDesde);
  });

  it('crea directo en la cancha del cliente y filtra por cancha', async () => {
    const c = await repos.tareas.crear({ titulo: 'Aprobar diseño', cancha: 'cliente' });
    expect(c.esperandoDesde).toBe(reloj.toISOString());
    await repos.tareas.crear({ titulo: 'Maquetar', seguimiento: reloj.toISOString() });
    expect((await repos.tareas.listar({ cancha: 'cliente' })).map((x) => x.titulo)).toEqual(['Aprobar diseño']);
    const mia = await repos.tareas.listar({ cancha: 'mia' });
    expect(mia.map((x) => x.titulo)).toEqual(['Maquetar']);
    expect(mia[0]).not.toHaveProperty('seguimiento');
    await expect(repos.tareas.crear({ titulo: 'X', cancha: 'otro' as 'mia' })).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('NotaRepository', () => {
  it('crea, valida, ordena (fijadas primero) y edita', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    await expect(repos.notas.crear({ proyectoId: p.id, contenido: '  ' })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(repos.notas.crear({ proyectoId: 'nope', contenido: 'x' })).rejects.toBeInstanceOf(ErrorValidacion);

    const a = await repos.notas.crear({ proyectoId: p.id, titulo: 'Accesos', contenido: ' FTP: …\n ' });
    expect(a).toMatchObject({ titulo: 'Accesos', contenido: 'FTP: …', fijada: false });
    avanzar();
    const b = await repos.notas.crear({ proyectoId: p.id, contenido: 'Llamada del lunes' });
    expect(b).not.toHaveProperty('titulo');
    expect((await repos.notas.listar({ proyectoId: p.id })).map((n) => n.id)).toEqual([b.id, a.id]);

    avanzar();
    await repos.notas.actualizar(a.id, { fijada: true });
    expect((await repos.notas.listar({ proyectoId: p.id })).map((n) => n.id)).toEqual([a.id, b.id]);

    const sinTitulo = await repos.notas.actualizar(a.id, { titulo: null });
    expect(sinTitulo).not.toHaveProperty('titulo');
    await expect(repos.notas.actualizar(b.id, { contenido: '' })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('eliminar, restaurar y borrado junto con el proyecto', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    const n = await repos.notas.crear({ proyectoId: p.id, contenido: 'x' });
    await repos.notas.eliminar(n.id);
    expect(await repos.notas.listar()).toHaveLength(0);
    await repos.notas.restaurar(n.id);
    expect(await repos.notas.obtener(n.id)).toBeDefined();

    await repos.proyectos.eliminar(p.id, 'desasignar');
    expect(await repos.notas.listar()).toHaveLength(0);
    await expect(repos.notas.restaurar(n.id)).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('Preferencias', () => {
  it('guarda y lee valores', async () => {
    expect(await repos.preferencias.obtener('idioma')).toBeUndefined();
    await repos.preferencias.guardar('idioma', 'en');
    expect(await repos.preferencias.obtener<string>('idioma')).toBe('en');
  });
});

describe('obtenerResumenPendientes', () => {
  it('combina tareas y proyectos de los repositorios', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Casa', color: '#EF4444' });
    await repos.tareas.crear({ titulo: 'Hoy', proyectoId: p.id, deadline: new Date(2026, 9, 12, 20).toISOString() });
    await repos.tareas.crear({ titulo: 'Vencida', deadline: new Date(2026, 9, 11, 20).toISOString() });
    const hecha = await repos.tareas.crear({ titulo: 'Hecha', deadline: new Date(2026, 9, 12, 20).toISOString() });
    await repos.tareas.cambiarEstado(hecha.id, 'hecha');

    const resumen = await obtenerResumenPendientes(repos, { ahora: reloj });
    expect(resumen.conteos).toMatchObject({ vencidas: 1, hoy: 1 });
    expect(resumen.hoy[0]?.proyecto).toEqual({ id: p.id, nombre: 'Casa', color: '#ef4444' });
  });
});

describe('Migraciones', () => {
  it('v1 → v2: las tareas existentes quedan en la cancha propia', async () => {
    const nombre = `bitacora-migracion-${++numeroDB}`;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({
      proyectos: 'id, estado, updatedAt',
      tareas: 'id, proyectoId, estado, deadline, updatedAt',
      preferencias: 'clave',
    });
    const fecha = reloj.toISOString();
    await v1.table('tareas').add({ id: 'a', titulo: 'Vieja', prioridad: 'media', estado: 'pendiente', createdAt: fecha, updatedAt: fecha });
    v1.close();

    const migrados = crearRepositorios({ nombreDB: nombre, ahora: () => reloj });
    expect(await migrados.tareas.obtener('a')).toMatchObject({ titulo: 'Vieja', cancha: 'mia' });
    expect(await migrados.notas.listar()).toEqual([]);
  });
});

describe('Checklist', () => {
  it('guarda pasos, descarta vacíos, conserva ids y se puede quitar', async () => {
    const t = await repos.tareas.crear({ titulo: 'Landing', checklist: [{ texto: ' Header ' }, { texto: '  ' }, { texto: 'Footer', hecho: true }] });
    expect(t.checklist?.map((i) => [i.texto, i.hecho])).toEqual([
      ['Header', false],
      ['Footer', true],
    ]);
    const [header, footer] = t.checklist!;
    const editada = await repos.tareas.actualizar(t.id, { checklist: [{ ...header!, hecho: true }, footer!, { texto: 'SEO' }] });
    expect(editada.checklist?.[0]).toEqual({ ...header, hecho: true });
    expect(editada.checklist).toHaveLength(3);
    const sin = await repos.tareas.actualizar(t.id, { checklist: [] });
    expect(sin).not.toHaveProperty('checklist');
  });
});

describe('Historial', () => {
  const tipos = async (proyectoId: string) => (await repos.historial.listar({ proyectoId })).map((e) => e.detalle.tipo);

  it('registra la vida del proyecto y sus tareas (más reciente primero)', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    avanzar();
    const t = await repos.tareas.crear({ titulo: 'Logo', proyectoId: p.id });
    avanzar();
    await repos.tareas.actualizar(t.id, { deadline: reloj.toISOString() });
    avanzar();
    await repos.tareas.actualizar(t.id, { cancha: 'cliente' });
    avanzar(10);
    await repos.tareas.cambiarEstado(t.id, 'hecha');
    avanzar();
    await repos.tareas.crear({ titulo: 'Suelta' }); // sin proyecto: no deja rastro
    await repos.historial.registrarCambio(p.id, 'El cliente pidió otra tipografía');

    expect(await tipos(p.id)).toEqual(['cambio', 'tarea_completada', 'cancha', 'deadline_tarea', 'tarea_creada', 'proyecto_creado']);
  });

  it('"Deshacer" anula el evento anterior en lugar de duplicar ruido', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    avanzar();
    const t = await repos.tareas.crear({ titulo: 'Logo', proyectoId: p.id });
    avanzar();
    await repos.tareas.cambiarEstado(t.id, 'hecha');
    await repos.tareas.cambiarEstado(t.id, 'pendiente');
    await repos.tareas.eliminar(t.id);
    await repos.tareas.restaurar(t.id);
    await repos.proyectos.archivar(p.id);
    await repos.proyectos.actualizar(p.id, { estado: 'activo' });
    expect(await tipos(p.id)).toEqual(['tarea_creada', 'proyecto_creado']);

    // Pasado el margen, reabrir sí queda registrado.
    await repos.tareas.cambiarEstado(t.id, 'hecha');
    avanzar(5);
    await repos.tareas.cambiarEstado(t.id, 'pendiente');
    expect((await tipos(p.id)).slice(0, 2)).toEqual(['tarea_reabierta', 'tarea_completada']);
  });

  it('solo los cambios anotados se pueden borrar y restaurar; se van con el proyecto', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    avanzar();
    const cambio = await repos.historial.registrarCambio(p.id, 'Agregar sección de blog');
    await expect(repos.historial.registrarCambio(p.id, ' ')).rejects.toBeInstanceOf(ErrorValidacion);
    const [creado] = (await repos.historial.listar({ proyectoId: p.id })).filter((e) => e.detalle.tipo === 'proyecto_creado');
    await expect(repos.historial.eliminar(creado!.id)).rejects.toBeInstanceOf(ErrorNoEncontrado);

    await repos.historial.eliminar(cambio.id);
    expect(await tipos(p.id)).toEqual(['proyecto_creado']);
    await repos.historial.restaurar(cambio.id);
    expect(await tipos(p.id)).toEqual(['cambio', 'proyecto_creado']);

    await repos.proyectos.eliminar(p.id);
    expect(await repos.historial.listar()).toEqual([]);
  });
});

describe('Entrega de proyecto', () => {
  it('fija la estimación inicial una vez y registra re-estimaciones y entrega', async () => {
    const d = (dia: number) => new Date(2026, 9, dia, 23, 59).toISOString();
    const p = await repos.proyectos.crear({ nombre: 'Web', inicio: d(1), entregaEstimada: d(20) });
    expect(p).toMatchObject({ entregaEstimada: d(20), entregaEstimadaInicial: d(20) });

    avanzar(10);
    const re = await repos.proyectos.actualizar(p.id, { entregaEstimada: d(27) });
    expect(re).toMatchObject({ entregaEstimada: d(27), entregaEstimadaInicial: d(20) });

    avanzar(10);
    const entregado = await repos.proyectos.actualizar(p.id, { entregadoEn: d(28) });
    expect(entregado.entregadoEn).toBe(d(28));

    const sinEstimar = await repos.proyectos.crear({ nombre: 'Otro' });
    const conEstimacion = await repos.proyectos.actualizar(sinEstimar.id, { entregaEstimada: d(30) });
    expect(conEstimacion.entregaEstimadaInicial).toBe(d(30));

    const eventos = (await repos.historial.listar({ proyectoId: p.id })).map((e) => e.detalle);
    expect(eventos.slice(0, 2)).toEqual([
      { tipo: 'proyecto_entregado', fecha: d(28) },
      { tipo: 'entrega_estimada', de: d(20), a: d(27) },
    ]);
    // Los dos de la creación comparten instante; el orden entre ellos no importa.
    expect(eventos.slice(2)).toEqual(
      expect.arrayContaining([{ tipo: 'proyecto_creado' }, { tipo: 'entrega_estimada', a: d(20) }]),
    );
    await expect(repos.proyectos.actualizar(p.id, { entregadoEn: 'ayer' })).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('Archivos', () => {
  const contenidoDe = (id: string) =>
    new Promise<{ contenido: Blob; enLaNube: boolean } | undefined>((resolver) => {
      const cancelar = repos.archivos.observarContenido(id, (valor) => {
        cancelar();
        resolver(valor);
      });
    });

  it('guarda datos y contenido, lista del más reciente al más antiguo y renombra', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    const viejo = await repos.archivos.crear({
      proyectoId: p.id,
      nombre: ' Cotización.pdf ',
      contenido: new Blob(['%PDF'], { type: 'application/pdf' }),
    });
    avanzar();
    const nuevo = await repos.archivos.crear({ proyectoId: p.id, nombre: 'notas.txt', contenido: new Blob(['hola']) });
    expect(viejo).toMatchObject({ nombre: 'Cotización.pdf', tipo: 'application/pdf', tamano: 4 });
    expect(nuevo).not.toHaveProperty('tipo');
    expect((await repos.archivos.listar({ proyectoId: p.id })).map((a) => a.id)).toEqual([nuevo.id, viejo.id]);

    const guardado = await contenidoDe(viejo.id);
    expect(guardado?.enLaNube).toBe(false);
    expect(await guardado?.contenido.text()).toBe('%PDF');

    avanzar();
    const renombrado = await repos.archivos.actualizar(viejo.id, { nombre: 'Cotización v2.pdf' });
    expect(renombrado.nombre).toBe('Cotización v2.pdf');
    expect(renombrado.updatedAt).toBe(reloj.toISOString());
    await expect(repos.archivos.actualizar(viejo.id, { nombre: '  ' })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('valida proyecto, nombre y tamaño', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    const blob = new Blob(['x']);
    await expect(repos.archivos.crear({ proyectoId: 'nope', nombre: 'a', contenido: blob })).rejects.toBeInstanceOf(ErrorValidacion);
    await expect(repos.archivos.crear({ proyectoId: p.id, nombre: ' ', contenido: blob })).rejects.toBeInstanceOf(ErrorValidacion);
    const enorme = { size: 51 * 1024 * 1024, type: '' } as Blob;
    await expect(repos.archivos.crear({ proyectoId: p.id, nombre: 'a', contenido: enorme })).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it('elimina, restaura y se eliminan con el proyecto', async () => {
    const p = await repos.proyectos.crear({ nombre: 'Web' });
    const a = await repos.archivos.crear({ proyectoId: p.id, nombre: 'a.pdf', contenido: new Blob(['x']) });
    await repos.archivos.eliminar(a.id);
    expect(await repos.archivos.listar()).toHaveLength(0);
    // El contenido se conserva para poder deshacer.
    expect(await contenidoDe(a.id)).toBeDefined();
    await repos.archivos.restaurar(a.id);
    expect(await repos.archivos.listar()).toHaveLength(1);

    await repos.proyectos.eliminar(p.id);
    expect(await repos.archivos.listar()).toHaveLength(0);
    await expect(repos.archivos.restaurar(a.id)).rejects.toBeInstanceOf(ErrorValidacion);
  });
});
