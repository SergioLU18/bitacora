import type { CapacitorConfig } from '@capacitor/cli';
import type { KeyboardResize } from '@capacitor/keyboard';

// La app de iOS carga Bitácora desde Netlify en vez de llevar la web empaquetada: cada deploy
// llega al iPhone sin reinstalar. Solo hace falta un binario nuevo (Xcode/TestFlight) cuando
// cambia algo nativo (plugins, permisos, el widget, este archivo).
// Para probar contra un build local, comenta `server` y corre `npm run ios`.
export const URL_APP = 'https://bitacora-lophex.netlify.app';

const config: CapacitorConfig = {
  appId: 'com.sergiolopez.bitacora',
  appName: 'Bitácora',
  webDir: 'dist',
  server: {
    url: URL_APP,
    cleartext: false,
    // Pantalla propia (empaquetada en la app) cuando no se puede cargar el sitio, en vez del
    // error genérico del WebView. Ver public/offline.html.
    errorPath: 'offline.html',
  },
  ios: {
    // Los safe areas los gestiona el CSS (viewport-fit=cover).
    contentInset: 'never',
  },
  plugins: {
    Keyboard: {
      // El WebView no cambia de tamaño al abrir el teclado (eso reacomodaba toda la pantalla de golpe).
      // La app escucha la altura del teclado y sube solo el sheet activo: src/lib/teclado.ts.
      resize: 'none' as KeyboardResize,
    },
  },
};

export default config;
