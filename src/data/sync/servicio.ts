import type { RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';
import { liveQuery } from 'dexie';
import type { Archivo } from '../../domain/types';
import type { BitacoraDB } from '../repositories/dexie/db';
import { rutaArchivo, SubidaArchivos } from './archivos';
import { MotorSync } from './motor';
import { ArchivosSupabase, RemotoSupabase } from './supabase';
import { TABLAS_SYNC, type EstadoSync } from './tipos';

/** Espera tras un cambio local antes de sincronizar (agrupa ráfagas de ediciones). */
const MS_TRAS_CAMBIO = 1500;
/** Espera tras un aviso de Realtime (otro dispositivo cambió algo). */
const MS_TRAS_AVISO = 400;
/** Respaldo por si se pierde algún aviso. */
const MS_PERIODICO = 5 * 60_000;

type Oyente = (estado: EstadoSync) => void;

/**
 * Marca en `user_metadata` de que la cuenta ya tiene contraseña. Supabase no expone si un usuario
 * tiene contraseña, así que la app la anota al crearla: sin ella, la cuenta se trata como nueva.
 */
const MARCA_CONTRASENA = 'contrasena_definida';

const sinContrasena = (usuario: User) => usuario.user_metadata?.[MARCA_CONTRASENA] !== true;

/**
 * Cuenta y sincronización. Decide cuándo correr el motor: al iniciar sesión, al abrir o volver
 * a la app, al recuperar la conexión, poco después de cada cambio local, cuando Realtime avisa
 * que otro dispositivo cambió algo y cada pocos minutos.
 */
export class ServicioSync {
  private readonly cliente: SupabaseClient | undefined;
  private readonly db: BitacoraDB;
  private readonly motor: MotorSync | undefined;
  private readonly archivosRemotos: ArchivosSupabase | undefined;
  private readonly subida: SubidaArchivos | undefined;
  private estado: EstadoSync;
  private readonly oyentes = new Set<Oyente>();
  private usuarioId: string | undefined;
  private enCurso: Promise<void> | undefined;
  private repetir = false;
  private espera: ReturnType<typeof setTimeout> | undefined;
  private canal: RealtimeChannel | undefined;

  constructor(db: BitacoraDB, cliente: SupabaseClient | undefined) {
    this.db = db;
    this.cliente = cliente;
    this.motor = cliente ? new MotorSync(db, new RemotoSupabase(cliente)) : undefined;
    this.archivosRemotos = cliente ? new ArchivosSupabase(cliente) : undefined;
    this.subida = this.archivosRemotos ? new SubidaArchivos(db, this.archivosRemotos) : undefined;
    this.estado = { fase: cliente ? 'iniciando' : 'desactivada' };
  }

  get disponible(): boolean {
    return !!this.cliente;
  }

  obtenerEstado = (): EstadoSync => this.estado;

  observar = (oyente: Oyente): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  /** Engancha la sesión y los disparadores. Se llama una vez al arrancar la app. */
  iniciar(): void {
    const cliente = this.cliente;
    if (!cliente) return;

    cliente.auth.onAuthStateChange((_evento, sesion) => {
      const id = sesion?.user.id;
      if (id === this.usuarioId) {
        // Misma cuenta (token renovado, contraseña nueva…): solo se refrescan sus datos.
        if (sesion) this.fijar({ ...this.estado, correo: sesion.user.email, sinContrasena: sinContrasena(sesion.user) });
        // Al arrancar sin sesión guardada, el id también es undefined: hay que salir de `iniciando`.
        else if (this.estado.fase === 'iniciando') this.fijar({ fase: 'sin-sesion' });
        return;
      }
      this.usuarioId = id;
      if (id) {
        this.fijar({ fase: 'sincronizando', correo: sesion.user.email, sinContrasena: sinContrasena(sesion.user) });
        this.conectarRealtime(cliente);
        // No se llama a Supabase dentro de este callback (puede bloquear la sesión).
        this.programar(0);
      } else {
        this.desconectarRealtime(cliente);
        this.fijar({ fase: 'sin-sesion' });
      }
    });

    // Cambios locales: cualquier escritura nueva cambia el último `updatedAt` de su tabla.
    let primera = true;
    liveQuery(() => Promise.all(TABLAS_SYNC.map((t) => this.db.table(t).orderBy('updatedAt').last()))).subscribe({
      next: () => {
        if (primera) primera = false;
        else this.programar(MS_TRAS_CAMBIO);
      },
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.programar(0);
    });
    window.addEventListener('online', () => this.programar(0));
    setInterval(() => {
      if (document.visibilityState === 'visible') this.programar(0);
    }, MS_PERIODICO);
  }

  async enviarCodigo(correo: string): Promise<void> {
    // Sin registro abierto: solo entran cuentas que ya existen en el proyecto.
    const { error } = await this.requerirCliente().auth.signInWithOtp({
      email: correo.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  }

  async entrarConContrasena(correo: string, contrasena: string): Promise<void> {
    const { error } = await this.requerirCliente().auth.signInWithPassword({ email: correo.trim(), password: contrasena });
    if (error) throw error;
  }

  /** Crea o cambia la contraseña de la sesión actual y marca la cuenta como configurada. */
  async definirContrasena(contrasena: string): Promise<void> {
    const { error } = await this.requerirCliente().auth.updateUser({
      password: contrasena,
      data: { [MARCA_CONTRASENA]: true },
    });
    if (error) throw error;
  }

  async verificarCodigo(correo: string, codigo: string): Promise<void> {
    const { error } = await this.requerirCliente().auth.verifyOtp({
      email: correo.trim(),
      token: codigo.replace(/\D/g, ''),
      type: 'email',
    });
    if (error) throw error;
  }

  /** Cierra la sesión. Los datos se quedan en el dispositivo; solo deja de sincronizar. */
  async cerrarSesion(): Promise<void> {
    await this.requerirCliente().auth.signOut();
  }

  /**
   * Enlace temporal al archivo en la nube, o `undefined` sin sesión o si aún no se ha subido.
   * Con `descargar`, el navegador lo baja con su nombre en vez de abrirlo.
   */
  async enlaceArchivo(archivo: Archivo, descargar = false): Promise<string | undefined> {
    if (!this.archivosRemotos || !this.usuarioId) return undefined;
    try {
      return await this.archivosRemotos.enlace(rutaArchivo(this.usuarioId, archivo.id), descargar ? archivo.nombre : undefined);
    } catch {
      return undefined; // Sin red: se abre la copia local, si la hay.
    }
  }

  sincronizarAhora(): Promise<void> {
    clearTimeout(this.espera);
    return this.correr();
  }

  private programar(ms: number): void {
    if (!this.usuarioId) return;
    clearTimeout(this.espera);
    this.espera = setTimeout(() => void this.correr(), ms);
  }

  private correr(): Promise<void> {
    if (!this.motor || !this.usuarioId) return Promise.resolve();
    if (this.enCurso) {
      // Llegaron cambios durante la pasada: se hace otra al terminar.
      this.repetir = true;
      return this.enCurso;
    }
    const usuarioId = this.usuarioId;
    const motor = this.motor;
    const subida = this.subida;
    this.enCurso = (async () => {
      this.fijar({ ...this.estado, fase: 'sincronizando', error: undefined });
      try {
        await motor.sincronizar(usuarioId);
        // Después de los datos: así el archivo ya existe en el servidor cuando llega su contenido.
        await subida?.subirPendientes(usuarioId);
        this.fijar({ ...this.estado, fase: 'al-dia', ultimaVez: new Date().toISOString() });
      } catch (error) {
        const sinRed = typeof navigator !== 'undefined' && !navigator.onLine;
        // Sin red es lo normal en el móvil: se reintenta al volver la conexión.
        if (!sinRed) console.error(error);
        this.fijar({
          ...this.estado,
          fase: sinRed ? 'sin-conexion' : 'error',
          error: sinRed ? undefined : error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.enCurso = undefined;
        if (this.repetir) {
          this.repetir = false;
          this.programar(0);
        }
      }
    })();
    return this.enCurso;
  }

  private conectarRealtime(cliente: SupabaseClient): void {
    this.desconectarRealtime(cliente);
    const canal = cliente.channel('bitacora-sync');
    for (const tabla of TABLAS_SYNC) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, () => this.programar(MS_TRAS_AVISO));
    }
    this.canal = canal.subscribe();
  }

  private desconectarRealtime(cliente: SupabaseClient): void {
    if (this.canal) void cliente.removeChannel(this.canal);
    this.canal = undefined;
  }

  private fijar(estado: EstadoSync): void {
    this.estado = estado;
    for (const oyente of this.oyentes) oyente(estado);
  }

  private requerirCliente(): SupabaseClient {
    if (!this.cliente) throw new Error('Sincronización no configurada');
    return this.cliente;
  }
}
