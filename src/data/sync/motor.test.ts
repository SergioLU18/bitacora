import { beforeEach, describe, expect, it } from 'vitest';
import { crearRepositorios } from '../repositories';
import { BitacoraDB } from '../repositories/dexie/db';
import type { Repositorios } from '../repositories/types';
import { SubidaArchivos } from './archivos';
import { MotorSync } from './motor';
import type { FilaRemota, RemotoArchivos, RemotoSync, TablaSync } from './tipos';

/** Servidor en memoria con las mismas reglas que la migración de Supabase. */
class RemotoFalso implements RemotoSync {
  filas = new Map<string, Required<FilaRemota> & { usuario: string }>();
  usuario = 'u1';
  private reloj = Date.UTC(2026, 9, 1);
  peticiones = 0;

  async subir(tabla: TablaSync, filas: readonly FilaRemota[]) {
    this.peticiones++;
    for (const fila of filas) {
      const clave = `${tabla}:${fila.id}`;
      const actual = this.filas.get(clave);
      if (actual && fila.datos.updatedAt < actual.datos.updatedAt) continue; // gana la última edición
      this.reloj += 1000;
      this.filas.set(clave, { ...fila, servidor_en: new Date(this.reloj).toISOString(), usuario: this.usuario });
    }
  }

  async bajar(tabla: TablaSync, desde: string | undefined, limite: number) {
    this.peticiones++;
    return [...this.filas.entries()]
      .filter(([clave, f]) => clave.startsWith(`${tabla}:`) && f.usuario === this.usuario && (!desde || f.servidor_en > desde))
      .map(([, f]) => ({ id: f.id, datos: structuredClone(f.datos), servidor_en: f.servidor_en }))
      .sort((a, b) => (a.servidor_en < b.servidor_en ? -1 : 1))
      .slice(0, limite);
  }
}

let n = 0;
let reloj: Date;
const avanzar = (min = 1) => {
  reloj = new Date(reloj.getTime() + min * 60_000);
};

/** Un "dispositivo": su propia base local, sus repositorios y su motor contra el mismo servidor. */
function dispositivo(remoto: RemotoSync) {
  const db = new BitacoraDB(`sync-test-${++n}`);
  const repos: Repositorios = crearRepositorios({ db, ahora: () => reloj });
  return { db, repos, motor: new MotorSync(db, remoto) };
}

let remoto: RemotoFalso;
beforeEach(() => {
  remoto = new RemotoFalso();
  reloj = new Date(2026, 9, 12, 10, 0);
});

describe('MotorSync', () => {
  it('sube lo local y otro dispositivo lo recibe completo', async () => {
    const a = dispositivo(remoto);
    const p = await a.repos.proyectos.crear({ nombre: 'Web', cliente: 'Ana' });
    await a.repos.tareas.crear({ titulo: 'Logo', proyectoId: p.id, checklist: [{ texto: 'Boceto' }] });
    await a.repos.notas.crear({ proyectoId: p.id, contenido: 'Accesos' });
    expect(await a.motor.pendientes()).toBeGreaterThan(0);
    await a.motor.sincronizar('u1');
    expect(await a.motor.pendientes()).toBe(0);

    const b = dispositivo(remoto);
    await b.motor.sincronizar('u1');
    expect(await b.repos.proyectos.obtener(p.id)).toEqual(await a.repos.proyectos.obtener(p.id));
    expect((await b.repos.tareas.listar())[0]?.checklist?.[0]?.texto).toBe('Boceto');
    expect(await b.repos.notas.listar()).toHaveLength(1);
    expect((await b.repos.historial.listar({ proyectoId: p.id })).length).toBeGreaterThan(0);
    // Lo recién bajado no se vuelve a subir.
    expect(await b.motor.pendientes()).toBe(0);
  });

  it('gana la edición más reciente, venga de donde venga', async () => {
    const a = dispositivo(remoto);
    const b = dispositivo(remoto);
    const t = await a.repos.tareas.crear({ titulo: 'Original' });
    await a.motor.sincronizar('u1');
    await b.motor.sincronizar('u1');

    avanzar();
    await a.repos.tareas.actualizar(t.id, { titulo: 'Editada en A' });
    avanzar();
    await b.repos.tareas.actualizar(t.id, { titulo: 'Editada en B (más tarde)' });

    await b.motor.sincronizar('u1');
    await a.motor.sincronizar('u1'); // A sube su versión vieja: el servidor la descarta y A recibe la de B
    await b.motor.sincronizar('u1');
    expect((await a.repos.tareas.obtener(t.id))?.titulo).toBe('Editada en B (más tarde)');
    expect((await b.repos.tareas.obtener(t.id))?.titulo).toBe('Editada en B (más tarde)');
  });

  it('una edición local más nueva no se pisa al bajar y se sube después', async () => {
    const a = dispositivo(remoto);
    const b = dispositivo(remoto);
    const t = await a.repos.tareas.crear({ titulo: 'v1' });
    await a.motor.sincronizar('u1');
    await b.motor.sincronizar('u1');
    avanzar();
    await a.repos.tareas.actualizar(t.id, { titulo: 'v2 de A' });
    await a.motor.sincronizar('u1');
    avanzar();
    await b.repos.tareas.actualizar(t.id, { titulo: 'v3 de B' });
    await b.motor.sincronizar('u1');
    expect((await b.repos.tareas.obtener(t.id))?.titulo).toBe('v3 de B');
    await a.motor.sincronizar('u1');
    expect((await a.repos.tareas.obtener(t.id))?.titulo).toBe('v3 de B');
  });

  it('propaga borrados lógicos y restauraciones', async () => {
    const a = dispositivo(remoto);
    const b = dispositivo(remoto);
    const t = await a.repos.tareas.crear({ titulo: 'Borrar' });
    await a.motor.sincronizar('u1');
    await b.motor.sincronizar('u1');
    avanzar();
    await a.repos.tareas.eliminar(t.id);
    await a.motor.sincronizar('u1');
    await b.motor.sincronizar('u1');
    expect(await b.repos.tareas.obtener(t.id)).toBeUndefined();
    avanzar();
    await b.repos.tareas.restaurar(t.id);
    await b.motor.sincronizar('u1');
    await a.motor.sincronizar('u1');
    expect(await a.repos.tareas.obtener(t.id)).toBeDefined();
  });

  it('al cambiar de cuenta sube todo lo local a la nueva', async () => {
    const a = dispositivo(remoto);
    await a.repos.tareas.crear({ titulo: 'Mía' });
    await a.motor.sincronizar('u1');
    remoto.usuario = 'u2';
    await a.motor.sincronizar('u2');
    const b = dispositivo(remoto);
    await b.motor.sincronizar('u2');
    expect((await b.repos.tareas.listar()).map((t) => t.titulo)).toEqual(['Mía']);
  });

  it('pagina lotes grandes y una pasada sin cambios no sube nada', async () => {
    const a = dispositivo(remoto);
    await a.db.tareas.bulkAdd(
      Array.from({ length: 1203 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        titulo: `T${i}`,
        prioridad: 'media' as const,
        estado: 'pendiente' as const,
        cancha: 'mia' as const,
        createdAt: reloj.toISOString(),
        updatedAt: reloj.toISOString(),
      })),
    );
    await a.motor.sincronizar('u1');
    const b = dispositivo(remoto);
    await b.motor.sincronizar('u1');
    expect(await b.db.tareas.count()).toBe(1203);

    const antes = remoto.peticiones;
    await b.motor.sincronizar('u1');
    // Solo consultas de bajada (una por tabla, con solape); ninguna subida.
    expect(remoto.peticiones - antes).toBeLessThanOrEqual(4 * 4);
    expect(await b.motor.pendientes()).toBe(0);
  });
});

/** Storage en memoria: guarda el contenido por ruta. */
class ArchivosFalsos implements RemotoArchivos {
  objetos = new Map<string, { contenido: Blob; tipo?: string }>();
  fallar = false;

  async subir(ruta: string, contenido: ArrayBuffer, tipo: string | undefined) {
    if (this.fallar) throw new Error('sin red');
    this.objetos.set(ruta, { contenido: new Blob([contenido], { type: tipo }), tipo });
  }

  async enlace(ruta: string) {
    return this.objetos.has(ruta) ? `https://falso/${ruta}` : undefined;
  }
}

describe('SubidaArchivos', () => {
  it('sube el contenido una vez, reintenta tras un fallo y otro dispositivo recibe los datos', async () => {
    const storage = new ArchivosFalsos();
    const a = dispositivo(remoto);
    const subida = new SubidaArchivos(a.db, storage);
    const p = await a.repos.proyectos.crear({ nombre: 'Web' });
    const archivo = await a.repos.archivos.crear({
      proyectoId: p.id,
      nombre: 'Cotización.pdf',
      contenido: new Blob(['%PDF'], { type: 'application/pdf' }),
    });

    storage.fallar = true;
    await a.motor.sincronizar('u1');
    await expect(subida.subirPendientes('u1')).rejects.toThrow('sin red');
    expect(await subida.pendientes()).toBe(1);

    storage.fallar = false;
    await subida.subirPendientes('u1');
    expect(await subida.pendientes()).toBe(0);
    const subido = storage.objetos.get(`u1/${archivo.id}`);
    expect(subido?.tipo).toBe('application/pdf');
    expect(await subido?.contenido.text()).toBe('%PDF');

    // Los datos viajan con el motor; el contenido no se copia al otro dispositivo.
    const b = dispositivo(remoto);
    await b.motor.sincronizar('u1');
    expect(await b.repos.archivos.listar()).toEqual([archivo]);
    expect(await b.db.contenidos.count()).toBe(0);
  });

  it('al entrar con otra cuenta, el contenido se vuelve a subir a esa cuenta', async () => {
    const storage = new ArchivosFalsos();
    const a = dispositivo(remoto);
    const subida = new SubidaArchivos(a.db, storage);
    const p = await a.repos.proyectos.crear({ nombre: 'Web' });
    const archivo = await a.repos.archivos.crear({ proyectoId: p.id, nombre: 'a.pdf', contenido: new Blob(['x']) });
    await a.motor.sincronizar('u1');
    await subida.subirPendientes('u1');

    remoto.usuario = 'u2';
    await a.motor.sincronizar('u2');
    expect(await subida.pendientes()).toBe(1);
    await subida.subirPendientes('u2');
    expect(storage.objetos.has(`u2/${archivo.id}`)).toBe(true);
  });

  it('sube registros viejos guardados como Blob y un contenido perdido no bloquea a los demás', async () => {
    const storage = new ArchivosFalsos();
    const a = dispositivo(remoto);
    const subida = new SubidaArchivos(a.db, storage);
    const p = await a.repos.proyectos.crear({ nombre: 'Web' });
    const viejo = await a.repos.archivos.crear({ proyectoId: p.id, nombre: 'viejo.txt', contenido: new Blob(['abc']) });
    const perdido = await a.repos.archivos.crear({ proyectoId: p.id, nombre: 'perdido.pdf', contenido: new Blob(['%PDF']) });
    // Registro anterior al cambio a ArrayBuffer, y uno cuyo Blob quedó vacío en el dispositivo (WebKit).
    await a.db.contenidos.put({ id: viejo.id, contenido: new Blob(['abc']), subido: 0 });
    await a.db.contenidos.put({ id: perdido.id, contenido: new Blob([]), subido: 0 });
    await a.motor.sincronizar('u1');

    await expect(subida.subirPendientes('u1')).rejects.toThrow('perdido.pdf');
    expect(await storage.objetos.get(`u1/${viejo.id}`)?.contenido.text()).toBe('abc');
    expect(storage.objetos.has(`u1/${perdido.id}`)).toBe(false);
    expect(await subida.pendientes()).toBe(1);
  });
});
