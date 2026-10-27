import { parseISO } from 'date-fns';
import { ChartColumn, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useEstadisticas } from '../../data/hooks/derivados';
import { entregaProbableDe, type EstadisticaProyecto } from '../../domain/estadisticas';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { nombreDia } from '../../lib/fechas';
import { formatearDecimal, formatearFactor } from '../../lib/numeros';
import { Seccion } from '../../ui/Pagina';
import { EstadoVacio, ListaCargando, PuntoColor } from '../../ui/Varios';

/** Ejemplo del consejo: "si crees que tomará 20 días, planea N". */
const DIAS_EJEMPLO = 20;

/**
 * Qué tan bien estimas: el factor real (mediana de real / estimado en proyectos entregados)
 * es la cifra principal; alrededor, puntualidad, duración, esperas y cambios.
 */
export function EstadisticasProyectos({ ahora }: { ahora: Date }) {
  const { t, locale } = useI18n();
  const datos = useEstadisticas(ahora);
  if (!datos) return <ListaCargando />;

  const { resumen } = datos;
  const lista = [...datos.porProyecto.values()];
  const entregados = lista
    .filter((e) => e.entregado)
    .sort((a, b) => (a.proyecto.entregadoEn! > b.proyecto.entregadoEn! ? -1 : 1));
  const enCurso = lista
    .filter((e) => !e.entregado && e.proyecto.estado !== 'archivado' && e.proyecto.entregaEstimada)
    .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));
  const decimal = (n: number) => formatearDecimal(n, locale);
  const dias = (n: number) => t.estadisticas.dias(n, decimal(n));

  const factor = resumen.factor;
  const preciso = factor !== undefined && Math.abs(factor - 1) < 0.05;

  return (
    <div>
      {resumen.entregados === 0 ? (
        <EstadoVacio icono={ChartColumn} titulo={t.estadisticas.vacioTitulo} texto={t.estadisticas.vacioTexto} compacto />
      ) : (
        <>
          {factor !== undefined && (
            <div className="mb-4 rounded-2xl border border-borde bg-superficie p-5 md:p-6">
              <p className="text-[13px] font-medium text-texto-2">{t.estadisticas.factor}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{formatearFactor(factor, locale)}</span>
                <span className="text-2xl font-semibold text-texto-2">×</span>
              </p>
              <p className="mt-3 flex max-w-prose items-start gap-2 text-[15px] md:text-sm">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-acento" aria-hidden />
                {preciso
                  ? t.estadisticas.consejoPreciso
                  : t.estadisticas.consejo(formatearFactor(factor, locale), DIAS_EJEMPLO, Math.ceil(DIAS_EJEMPLO * factor))}
              </p>
              {resumen.desviacionTareas !== undefined && (
                <p className="mt-1.5 pl-6 text-[13px] text-texto-2">{t.estadisticas.consejoTareas(resumen.desviacionTareas)}</p>
              )}
              <p className="mt-3 text-xs text-texto-3">{t.estadisticas.basadoEn(resumen.conEstimacion)}</p>
            </div>
          )}

          <dl className="mb-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Indicador etiqueta={t.estadisticas.entregados} valor={String(resumen.entregados)} />
            {resumen.aTiempoPorcentaje !== undefined && (
              <Indicador etiqueta={t.estadisticas.aTiempo} valor={`${resumen.aTiempoPorcentaje} %`} />
            )}
            {resumen.diasPromedio !== undefined && (
              <Indicador etiqueta={t.estadisticas.duracion} valor={dias(resumen.diasPromedio)} />
            )}
            {resumen.esperaPromedio !== undefined && (
              <Indicador etiqueta={t.estadisticas.esperaCliente} valor={dias(resumen.esperaPromedio)} />
            )}
            {resumen.cambiosPromedio !== undefined && (
              <Indicador etiqueta={t.estadisticas.cambios} valor={decimal(resumen.cambiosPromedio)} />
            )}
          </dl>

          <Seccion titulo={t.estadisticas.entregadosTitulo} contador={entregados.length}>
            <Tabla
              columnas={[t.estadisticas.estimado, t.estadisticas.real, t.estadisticas.desviacion, t.estadisticas.esperaCliente, t.estadisticas.columnaCambios]}
              filas={entregados.map((e) => ({
                estadistica: e,
                celdas: [
                  e.diasEstimados !== undefined ? dias(e.diasEstimados) : t.estadisticas.sinEstimacion,
                  dias(e.diasTranscurridos),
                  e.factor !== undefined ? <Desviacion factor={e.factor} /> : '—',
                  dias(e.diasEsperaCliente),
                  String(e.cambios),
                ],
              }))}
            />
          </Seccion>
        </>
      )}

      {enCurso.length > 0 && (
        <Seccion titulo={t.estadisticas.enCursoTitulo} contador={enCurso.length}>
          <Tabla
            columnas={[t.estadisticas.entrega, t.estadisticas.restante, t.estadisticas.probable, t.estadisticas.esperaCliente, t.estadisticas.columnaCambios]}
            filas={enCurso.map((e) => {
              const probable = entregaProbableDe(e.proyecto, factor);
              return {
                estadistica: e,
                celdas: [
                  nombreDia(parseISO(e.proyecto.entregaEstimada!), ahora, t, locale),
                  <span className={cn((e.diasRestantes ?? 0) < 0 && 'font-medium text-peligro')}>
                    {t.proyecto.faltan(e.diasRestantes ?? 0)}
                  </span>,
                  probable ? nombreDia(parseISO(probable), ahora, t, locale) : '—',
                  dias(e.diasEsperaCliente),
                  String(e.cambios),
                ],
              };
            })}
          />
        </Seccion>
      )}
    </div>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie px-4 py-3">
      <dd className="text-2xl font-bold tracking-tight">{valor}</dd>
      <dt className="mt-0.5 text-xs text-texto-2">{etiqueta}</dt>
    </div>
  );
}

/** "+30 %" en ámbar si tardó más de un 10 % extra; "−10 %" en neutro. El texto lleva el signo. */
function Desviacion({ factor }: { factor: number }) {
  const porcentaje = Math.round((factor - 1) * 100);
  return (
    <span className={cn('font-medium', porcentaje > 10 ? 'text-aviso' : 'text-texto')}>
      {porcentaje > 0 ? `+${porcentaje}` : porcentaje < 0 ? `−${-porcentaje}` : '0'} %
    </span>
  );
}

/**
 * Tabla responsiva: en escritorio, columnas alineadas con cifras tabulares;
 * en móvil, cada fila es una tarjeta con sus etiquetas.
 */
function Tabla({
  columnas,
  filas,
}: {
  columnas: string[];
  filas: Array<{ estadistica: EstadisticaProyecto; celdas: ReactNode[] }>;
}) {
  const { t } = useI18n();
  const plantilla = 'md:grid md:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] md:items-center md:gap-4';
  return (
    <div role="table" className="overflow-hidden rounded-2xl border border-borde bg-superficie">
      <div role="row" className={cn('hidden border-b border-borde px-4 py-2.5 text-xs font-medium text-texto-2', plantilla)}>
        <span role="columnheader">{t.estadisticas.proyecto}</span>
        {columnas.map((c) => (
          <span key={c} role="columnheader" className="text-right">
            {c}
          </span>
        ))}
      </div>
      {filas.map(({ estadistica: { proyecto }, celdas }) => (
        <div key={proyecto.id} role="row" className={cn('border-b border-borde px-4 py-3 text-sm last:border-b-0', plantilla)}>
          <span role="cell" className="mb-2 flex min-w-0 items-center gap-2 md:mb-0">
            <PuntoColor color={proyecto.color} className="size-2" />
            <Link to={`/proyectos/${proyecto.id}`} className="truncate font-medium hover:text-acento">
              {proyecto.nombre}
            </Link>
          </span>
          <div className="grid gap-y-1 sm:grid-cols-2 sm:gap-x-8 md:contents">
            {celdas.map((celda, i) => (
              <span key={columnas[i]} role="cell" className="flex justify-between gap-2 tabular-nums md:block md:text-right">
                <span className="text-texto-2 md:hidden">{columnas[i]}</span>
                {celda}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
