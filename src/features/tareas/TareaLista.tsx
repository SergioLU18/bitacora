import type { Proyecto, Tarea } from '../../domain/types';
import { TareaItem, type PropsTareaItem } from './TareaItem';

interface Props extends Omit<PropsTareaItem, 'tarea' | 'proyecto'> {
  tareas: readonly Tarea[];
  proyectos: ReadonlyMap<string, Proyecto>;
  etiqueta?: string;
}

export function TareaLista({ tareas, proyectos, etiqueta, ...resto }: Props) {
  return (
    <ul aria-label={etiqueta} className="@container -mx-3 flex flex-col">
      {tareas.map((tarea) => (
        <TareaItem
          key={tarea.id}
          tarea={tarea}
          proyecto={tarea.proyectoId ? proyectos.get(tarea.proyectoId) : undefined}
          {...resto}
        />
      ))}
    </ul>
  );
}
