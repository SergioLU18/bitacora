import type { PreferenciasRepository } from '../types';
import type { BitacoraDB } from './db';

export class DexiePreferenciasRepository implements PreferenciasRepository {
  private readonly db: BitacoraDB;

  constructor(db: BitacoraDB) {
    this.db = db;
  }

  async obtener<T>(clave: string): Promise<T | undefined> {
    const registro = await this.db.preferencias.get(clave);
    return registro?.valor as T | undefined;
  }

  async guardar<T>(clave: string, valor: T): Promise<void> {
    await this.db.preferencias.put({ clave, valor });
  }
}
