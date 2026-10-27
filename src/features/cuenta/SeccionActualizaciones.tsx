import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { CircleAlert, CircleCheck, Download, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useActualizacion } from '../../hooks/useActualizacion';
import { useAhora } from '../../hooks/useAhora';
import { useI18n } from '../../i18n/I18nProvider';
import { aplicarActualizacion, buscarActualizacion } from '../../lib/actualizaciones';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';

/** El número de build es la fecha (segundos Unix) del commit publicado. */
const publicadaEn = __BUILD_WEB__ > 0 ? new Date(__BUILD_WEB__ * 1000) : undefined;

/** Versión instalada y, en la app de iOS, el estado de las actualizaciones en vivo. */
export function SeccionActualizaciones() {
  const { t, locale } = useI18n();
  const estado = useActualizacion();
  const [aplicando, setAplicando] = useState(false);
  // Refresca el "hace N minutos".
  useAhora();

  const version = (
    <p className="text-[13px] text-texto-2">
      {t.ajustes.version(__VERSION_WEB__)}
      {publicadaEn && `, ${t.actualizacion.publicada(format(publicadaEn, t.fechas.formatoCompleto, { locale }))}`}
    </p>
  );

  if (estado.fase === 'no-disponible') return <div className="text-center">{version}</div>;

  const linea =
    estado.fase === 'buscando'
      ? { icono: LoaderCircle, texto: t.actualizacion.buscando, clase: 'text-texto-2', girar: true }
      : estado.fase === 'descargando'
        ? { icono: Download, texto: t.actualizacion.descargando, clase: 'text-texto-2' }
        : estado.fase === 'lista'
          ? { icono: Sparkles, texto: t.actualizacion.lista, clase: 'text-acento' }
          : estado.fase === 'error'
            ? { icono: CircleAlert, texto: t.actualizacion.error, clase: 'text-peligro' }
            : {
                icono: CircleCheck,
                texto: t.actualizacion.alDia(formatDistanceToNow(parseISO(estado.comprobadaEn), { addSuffix: true, locale })),
                clase: 'text-texto-2',
              };
  const Icono = linea.icono;

  const aplicar = async () => {
    setAplicando(true);
    try {
      await aplicarActualizacion(); // Reinicia la app; si falla, se queda como estaba.
    } finally {
      setAplicando(false);
    }
  };

  return (
    <section>
      <h3 className="mb-2 text-[13px] font-medium text-texto-2">{t.actualizacion.titulo}</h3>
      <div className="rounded-xl border border-borde p-4">
        {version}
        <p role="status" className={cn('mt-1.5 flex items-center gap-1.5 text-[13px]', linea.clase)}>
          <Icono className={cn('size-4 shrink-0', linea.girar && 'animate-spin')} aria-hidden />
          {linea.texto}
        </p>
        {estado.fase === 'lista' ? (
          <>
            <p className="mt-1 text-xs text-texto-3">{t.actualizacion.listaAyuda}</p>
            <Button
              variante="primario"
              icono={<RefreshCw className={cn('size-4', aplicando && 'animate-spin')} />}
              onClick={() => void aplicar()}
              disabled={aplicando}
              className="mt-4"
            >
              {t.actualizacion.actualizar}
            </Button>
          </>
        ) : (
          <Button
            icono={<RefreshCw className="size-4" />}
            onClick={() => void buscarActualizacion()}
            disabled={estado.fase === 'buscando'}
            className="mt-4"
          >
            {t.actualizacion.buscar}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Avisa una vez por versión descargada, con un botón para aplicarla sin salir de la app. */
export function AvisoActualizacion() {
  const { t } = useI18n();
  const { mostrar } = useToast();
  const estado = useActualizacion();
  const avisada = useRef<string>(undefined);

  useEffect(() => {
    if (estado.fase !== 'lista' || avisada.current === estado.bundleId) return;
    avisada.current = estado.bundleId;
    mostrar({
      mensaje: t.actualizacion.toast,
      duracionMs: 12_000,
      acciones: [
        {
          texto: t.actualizacion.toastAccion,
          icono: <RefreshCw className="size-4" aria-hidden />,
          alHacer: () => void aplicarActualizacion(),
        },
      ],
    });
  }, [estado, mostrar, t]);

  return null;
}
