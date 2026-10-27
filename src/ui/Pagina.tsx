import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAjustes } from '../app/AjustesProvider';
import { useI18n } from '../i18n/I18nProvider';
import { cn } from '../lib/cn';
import { IconButton } from './Button';

interface PropsPagina {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** Contenido sobre el título (p. ej. enlace "volver"). */
  antes?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
}

/** Estructura común de cada vista: encabezado con título grande y contenido. */
export function Pagina({ titulo, subtitulo, antes, acciones, children }: PropsPagina) {
  const { t } = useI18n();
  const { abrirAjustes } = useAjustes();
  const barraAcciones = (
    <div className="-mr-2 flex shrink-0 items-center gap-1 md:mr-0 md:gap-1.5">
      {acciones}
      <IconButton etiqueta={t.nav.ajustes} onClick={abrirAjustes} className="md:hidden">
        <Settings className="size-5" />
      </IconButton>
    </div>
  );
  const encabezado = (
    <div className="min-w-0 flex-1">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-[30px]">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-[15px] text-texto-2 md:text-sm">{subtitulo}</p>}
    </div>
  );

  return (
    <div className="w-full">
      <header className="mb-6 md:mb-8">
        {antes ? (
          // Con enlace de "volver", las acciones comparten su fila y el título usa todo el ancho.
          <>
            <div className="mb-2 flex items-center justify-between gap-3">
              {antes}
              {barraAcciones}
            </div>
            {encabezado}
          </>
        ) : (
          <div className="flex items-start gap-3">
            {encabezado}
            {barraAcciones}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

/** Título de sección dentro de una vista. */
export function Seccion({
  titulo,
  contador,
  tono,
  accion,
  children,
  className,
}: {
  titulo: ReactNode;
  contador?: number;
  tono?: 'peligro' | 'aviso';
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 className={cn('min-w-0 text-[13px] font-semibold tracking-wide uppercase', tono === 'peligro' ? 'text-peligro' : tono === 'aviso' ? 'text-aviso' : 'text-texto-2')}>
          {titulo}
        </h2>
        {contador !== undefined && <span className="text-[13px] font-medium text-texto-3 tabular-nums">{contador}</span>}
        {accion && <div className="ml-auto">{accion}</div>}
      </div>
      {children}
    </section>
  );
}
