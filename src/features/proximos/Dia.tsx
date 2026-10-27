import { addDays, format } from 'date-fns';
import { CalendarCheck, Plus } from 'lucide-react';
import { deadlineTodoElDia } from '../../domain/deadline';
import type { Proyecto, Tarea } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { capitalizar, valorDia } from '../../lib/fechas';
import { Button, IconButton } from '../../ui/Button';
import { EstadoVacio } from '../../ui/Varios';
import { useEditorTarea } from '../tareas/EditorTareaProvider';
import { TareaLista } from '../tareas/TareaLista';

/** Piezas compartidas por las vistas de semana y mes. */

export interface Dia {
  fecha: Date;
  clave: string;
  tareas: Tarea[];
}

export function useEtiquetasDia(fecha: Date, ahora: Date) {
  const { t, locale } = useI18n();
  const esHoy = valorDia(fecha) === valorDia(ahora);
  const esManana = valorDia(fecha) === valorDia(addDays(ahora, 1));
  const diaSemana = capitalizar(format(fecha, 'EEEE', { locale }));
  return {
    esHoy,
    esManana,
    diaSemana,
    corto: capitalizar(format(fecha, 'EEE', { locale })).replace('.', ''),
    numero: format(fecha, 'd'),
    largo: `${diaSemana} ${format(fecha, t.fechas.formatoFechaSinDia, { locale })}`,
    principal: esHoy ? t.fechas.hoy : esManana ? t.fechas.manana : diaSemana,
  };
}

/** Encabezado y tareas de un día concreto (lista bajo la franja o la cuadrícula). */
export function DiaMovil({ dia, proyectos, ahora }: { dia: Dia; proyectos: ReadonlyMap<string, Proyecto>; ahora: Date }) {
  const { t } = useI18n();
  const { nuevaTarea } = useEditorTarea();
  const etiquetas = useEtiquetasDia(dia.fecha, ahora);
  const agregar = () => nuevaTarea({ deadline: deadlineTodoElDia(dia.fecha) });

  return (
    <section role="tabpanel" aria-label={etiquetas.largo} key={dia.clave} className="animate-entrada">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">{etiquetas.principal}</span>
          <span className="truncate text-sm text-texto-2">{etiquetas.esHoy || etiquetas.esManana ? etiquetas.largo : etiquetas.largo.replace(etiquetas.diaSemana, '').trim()}</span>
        </h2>
        <IconButton etiqueta={t.proximos.agregarEn(etiquetas.largo)} onClick={agregar}>
          <Plus className="size-5" />
        </IconButton>
      </div>
      {dia.tareas.length > 0 ? (
        <TareaLista tareas={dia.tareas} proyectos={proyectos} ahora={ahora} soloHora seVaAlCompletar etiqueta={etiquetas.largo} />
      ) : (
        <EstadoVacio
          icono={CalendarCheck}
          titulo={t.proximos.diaLibreTitulo}
          texto={t.proximos.diaLibreTexto}
          compacto
          accion={
            <Button icono={<Plus className="size-4" />} onClick={agregar}>
              {t.acciones.agregarTarea}
            </Button>
          }
        />
      )}
    </section>
  );
}
