import { Capacitor } from '@capacitor/core';

/** Duración de la animación con la que sube el teclado de iOS; el CSS usa la misma. */
const MS_ANIMACION = 250;

/**
 * Expone la altura del teclado nativo en `--teclado` (en <html>), para que los sheets se
 * acomoden encima de él con una transición suave en vez de que el WebView se redimensione
 * (ver `plugins.Keyboard.resize` en capacitor.config.ts). En web la variable se queda en 0.
 */
export function iniciarTeclado(): void {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Keyboard')) return;
  const raiz = document.documentElement;
  let revelar: ReturnType<typeof setTimeout> | undefined;

  void import('@capacitor/keyboard').then(({ Keyboard }) => {
    void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
      raiz.style.setProperty('--teclado', `${keyboardHeight}px`);
      // Cuando el sheet ya se encogió, asegura que el campo enfocado quede a la vista.
      clearTimeout(revelar);
      revelar = setTimeout(() => {
        const activo = document.activeElement;
        if (activo instanceof HTMLElement) activo.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, MS_ANIMACION + 20);
    });
    void Keyboard.addListener('keyboardWillHide', () => {
      clearTimeout(revelar);
      raiz.style.setProperty('--teclado', '0px');
    });
  });
}
