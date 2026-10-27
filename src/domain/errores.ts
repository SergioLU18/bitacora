export class ErrorValidacion extends Error {
  readonly campo: string;

  constructor(campo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.campo = campo;
  }
}

type Entidad = 'proyecto' | 'tarea' | 'nota' | 'evento' | 'archivo';

export class ErrorNoEncontrado extends Error {
  readonly entidad: Entidad;
  readonly id: string;

  constructor(entidad: Entidad, id: string) {
    super(`No existe ${entidad} con id ${id}`);
    this.name = 'ErrorNoEncontrado';
    this.entidad = entidad;
    this.id = id;
  }
}
