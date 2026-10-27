import { format, parseISO, type Locale } from 'date-fns';
import { esperaAlCliente } from '../../domain/cancha';
import { entregaProbableDe, type EstadisticaProyecto } from '../../domain/estadisticas';
import { progresoChecklist, calcularProgreso } from '../../domain/progreso';
import { formatearDuracion } from '../../domain/tiempo';
import type { EventoHistorial, Proyecto, Tarea } from '../../domain/types';
import type { Mensajes } from '../../i18n/es';
import { formatearDecimal, formatearFactor } from '../../lib/numeros';

export type ModoEstado = 'cliente' | 'interno';

/** Máximo de tareas listadas por sección; el resto se resume en "…y N más". */
const MAXIMO_POR_SECCION = 10;

interface Datos {
  proyecto: Proyecto;
  tareas: readonly Tarea[];
  eventos: readonly EventoHistorial[];
  estadistica: EstadisticaProyecto | undefined;
  /** Factor histórico de entrega (mediana de proyectos anteriores). */
  factor: number | undefined;
  modo: ModoEstado;
  ahora: Date;
  t: Mensajes;
  locale: Locale;
}

/**
 * Resumen del proyecto en texto plano con *negritas* al estilo WhatsApp/Slack.
 * "cliente": avance y pendientes de cada lado. "interno": además estimación, esperas,
 * cambios y tiempos, para comparar con proyectos futuros.
 */
export function generarTextoEstado({ proyecto, tareas, eventos, estadistica, factor, modo, ahora, t, locale }: Datos): string {
  const e = t.estado;
  const dia = (iso: string) => format(parseISO(iso), t.fechas.formatoFechaSinDia, { locale });
  const lineas: string[] = [];
  const seccion = (titulo: string, items: string[]) => {
    if (items.length === 0) return;
    lineas.push('', `*${titulo}*`);
    for (const item of items.slice(0, MAXIMO_POR_SECCION)) lineas.push(`• ${item}`);
    if (items.length > MAXIMO_POR_SECCION) lineas.push(e.mas(items.length - MAXIMO_POR_SECCION));
  };
  const conPasos = (tarea: Tarea) => {
    const pasos = progresoChecklist(tarea);
    return pasos ? `${tarea.titulo} (${pasos.hechos}/${pasos.total})` : tarea.titulo;
  };

  // Encabezado
  lineas.push(`*${proyecto.nombre}*`);
  if (proyecto.cliente) lineas.push(proyecto.cliente);
  lineas.push(e.encabezado(format(ahora, t.fechas.formatoFechaSinDia, { locale })));
  const progreso = calcularProgreso(tareas);
  if (progreso.total > 0) lineas.push(e.avance(progreso.porcentaje, progreso.hechas, progreso.total));
  if (proyecto.entregadoEn) lineas.push(e.entregado(dia(proyecto.entregadoEn)));
  else if (proyecto.entregaEstimada) lineas.push(e.entrega(dia(proyecto.entregaEstimada)));

  // Tareas por situación
  const hechas = tareas
    .filter((x) => x.estado === 'hecha')
    .sort((a, b) => ((a.completadaEn ?? '') > (b.completadaEn ?? '') ? -1 : 1));
  const mias = tareas.filter((x) => x.estado !== 'hecha' && !esperaAlCliente(x));
  const delCliente = tareas.filter(esperaAlCliente);
  seccion(e.listo, hechas.map((x) => x.titulo));
  seccion(
    e.enProceso,
    mias.map((x) => (x.deadline ? `${conPasos(x)} — ${e.para(dia(x.deadline))}` : conPasos(x))),
  );
  seccion(
    e.deSuParte,
    delCliente.map((x) => (x.esperandoDesde ? `${conPasos(x)} — ${e.desde(dia(x.esperandoDesde))}` : conPasos(x))),
  );

  if (modo === 'cliente' || !estadistica) return lineas.join('\n');

  // Sección interna: cómo va la estimación
  const s = estadistica;
  const interna: string[] = [e.inicio(dia(s.inicio))];
  if (proyecto.entregaEstimadaInicial && s.diasEstimados !== undefined) {
    interna.push(e.original(dia(proyecto.entregaEstimadaInicial), s.diasEstimados));
  }
  if (proyecto.entregaEstimada && s.reestimaciones > 0) interna.push(e.vigente(dia(proyecto.entregaEstimada), s.reestimaciones));
  if (s.entregado) {
    interna.push(e.duracionReal(s.diasTranscurridos, s.factor !== undefined ? formatearFactor(s.factor, locale) : undefined));
  } else {
    interna.push(e.llevamos(s.diasTranscurridos));
    const probable = entregaProbableDe(proyecto, factor);
    if (probable) interna.push(e.probable(dia(probable)));
  }
  if (s.diasEsperaCliente > 0) interna.push(e.espera(formatearDecimal(s.diasEsperaCliente, locale)));
  interna.push(e.cambios(s.cambios));
  if (s.tiempo.estimadoTotal || s.tiempo.realTotal) {
    interna.push(
      e.tiempo(
        s.tiempo.estimadoTotal ? formatearDuracion(s.tiempo.estimadoTotal) : '—',
        s.tiempo.realTotal ? formatearDuracion(s.tiempo.realTotal) : '—',
      ),
    );
  }
  lineas.push('', `*${e.estimacion}*`, ...interna);

  const cambios = eventos.flatMap((ev) => (ev.detalle.tipo === 'cambio' ? [`${ev.detalle.texto} (${dia(ev.createdAt)})`] : []));
  seccion(e.cambiosTitulo, cambios);

  return lineas.join('\n');
}
