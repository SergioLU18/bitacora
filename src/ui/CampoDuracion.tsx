import { useId, useState } from 'react';
import { formatearDuracion, parsearDuracion } from '../domain/tiempo';
import { useI18n } from '../i18n/I18nProvider';
import { Campo, Chip, Input } from './Campos';

/** Atajos para el tiempo estimado. */
const SUGERENCIAS_MIN = [15, 30, 60, 120] as const;

/**
 * Campo de duración en texto libre ("45", "1h 30m", "1:30") con atajos rápidos.
 * Informa al padre los minutos (`undefined` = vacío) y si el texto es válido.
 */
export function CampoDuracion({
  etiqueta,
  minutos,
  alCambiar,
  sugerencias = SUGERENCIAS_MIN,
  autoFocus,
}: {
  etiqueta: string;
  minutos: number | undefined;
  alCambiar: (minutos: number | undefined, valido: boolean) => void;
  sugerencias?: readonly number[];
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const idAyuda = useId();
  const [texto, setTexto] = useState(minutos ? formatearDuracion(minutos) : '');
  const interpretado = parsearDuracion(texto);
  const invalido = interpretado === null;

  const cambiarTexto = (nuevo: string) => {
    setTexto(nuevo);
    const valor = parsearDuracion(nuevo);
    alCambiar(valor ?? undefined, valor !== null);
  };

  // Muestra cómo se entendió el texto si no está ya escrito en el formato canónico.
  const ayuda = invalido
    ? t.tiempo.invalido
    : interpretado !== undefined && formatearDuracion(interpretado) !== texto.trim()
      ? t.tiempo.equivale(formatearDuracion(interpretado))
      : undefined;

  return (
    <Campo etiqueta={etiqueta} htmlFor={id}>
      <Input
        id={id}
        value={texto}
        onChange={(e) => cambiarTexto(e.target.value)}
        onBlur={() => interpretado && setTexto(formatearDuracion(interpretado))}
        placeholder={t.tiempo.placeholder}
        inputMode="text"
        autoComplete="off"
        aria-invalid={invalido}
        aria-describedby={ayuda ? idAyuda : undefined}
        data-autofocus={autoFocus || undefined}
        className={invalido ? '!border-peligro' : undefined}
      />
      {ayuda && (
        <p id={idAyuda} className={invalido ? 'text-xs text-peligro' : 'text-xs text-texto-2'}>
          {ayuda}
        </p>
      )}
      {sugerencias.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {sugerencias.map((m) => (
            <Chip key={m} activo={interpretado === m} alCambiar={() => cambiarTexto(formatearDuracion(m))}>
              {formatearDuracion(m)}
            </Chip>
          ))}
        </div>
      )}
    </Campo>
  );
}
