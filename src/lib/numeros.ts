import type { Locale } from 'date-fns';

/** "1.3" / "1,3" según el idioma. */
export function formatearFactor(factor: number, locale: Locale): string {
  return new Intl.NumberFormat(locale.code, { maximumFractionDigits: 2 }).format(factor);
}

/** Número con un decimal como máximo: "4,5" / "4.5". */
export function formatearDecimal(valor: number, locale: Locale): string {
  return new Intl.NumberFormat(locale.code, { maximumFractionDigits: 1 }).format(valor);
}

/** Tamaño de archivo legible: "820 KB", "1,4 MB". */
export function formatearTamano(bytes: number, locale: Locale): string {
  const [valor, unidad] =
    bytes < 1024 * 1024 ? [Math.max(1, Math.round(bytes / 1024)), 'kilobyte'] : [bytes / (1024 * 1024), 'megabyte'];
  return new Intl.NumberFormat(locale.code, { style: 'unit', unit: unidad, maximumFractionDigits: 1 }).format(valor);
}
