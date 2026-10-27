import { useI18n } from '../../i18n/I18nProvider';
import { FormularioEntrar } from './SeccionCuenta';

/** Pantalla completa de acceso: la app no se usa sin sesión cuando hay Supabase configurado. */
export function PantallaAcceso() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-safe pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem+var(--teclado))]">
      <div className="w-full max-w-sm animate-entrada">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-acento text-sobre-acento shadow-elevada">
            <svg viewBox="0 0 16 16" className="size-8" aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">{t.app.nombre}</h1>
          <p className="mt-1 text-[15px] text-texto-2">{t.cuenta.accesoTexto}</p>
        </div>
        <div className="rounded-2xl bg-superficie shadow-elevada">
          <FormularioEntrar />
        </div>
      </div>
    </main>
  );
}
