import type { CapacitorConfig } from '@capacitor/cli';
import type { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.sergiolopez.bitacora',
  appName: 'Bitácora',
  webDir: 'dist',
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
    CapacitorUpdater: {
      // Actualizaciones en vivo auto-hospedadas: la lógica vive en src/lib/actualizaciones.ts
      // y descarga los bundles desde GitHub Releases. Nada se envía a los servidores de Capgo.
      autoUpdate: false,
      statsUrl: '',
      // Al instalar una versión nativa nueva (TestFlight/App Store) se vuelve al bundle empaquetado.
      resetWhenUpdate: true,
      keepUrlPathAfterReload: true,
    },
  },
};

export default config;
