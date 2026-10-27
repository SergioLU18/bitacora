import { format } from 'date-fns';
import { useI18n } from '../../i18n/I18nProvider';

/** El número de build es la fecha (segundos Unix) del commit publicado. */
const publicadaEn = __BUILD_WEB__ > 0 ? new Date(__BUILD_WEB__ * 1000) : undefined;

/** Versión de la web en uso. La app de iOS carga el sitio publicado, así que siempre es la última. */
export function SeccionVersion() {
  const { t, locale } = useI18n();
  return (
    <p className="text-center text-[13px] text-texto-2">
      {t.ajustes.version(__VERSION_WEB__)}
      {publicadaEn && `, ${t.ajustes.publicada(format(publicadaEn, t.fechas.formatoCompleto, { locale }))}`}
    </p>
  );
}
