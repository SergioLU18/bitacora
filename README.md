# Bitácora

Gestión personal de proyectos, tareas, notas y seguimiento a clientes. Web app (Vite + React + TypeScript) empaquetada con Capacitor. Funciona sin conexión y se sincroniza entre dispositivos con Supabase.

## Requisitos

- Node.js 20 o superior (desarrollado con Node 24)
- npm

## Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
```

| Script              | Qué hace                                         |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Servidor de desarrollo con recarga en caliente   |
| `npm run build`     | Verificación de tipos y build de producción en `dist/` |
| `npm run preview`   | Sirve el build de producción                     |
| `npm run typecheck` | Solo verificación de tipos (TypeScript strict)   |
| `npm test`          | Tests (Vitest + fake-indexeddb)                  |
| `npm run test:watch`| Tests en modo observación                        |
| `npm run db:push`   | Aplica las migraciones nuevas de `supabase/migrations` |
| `npm run db:config` | Sube `supabase/config.toml` (auth, plantilla del correo) |

## App de iOS (Capacitor)

El proyecto nativo vive en `ios/` (Capacitor 8 con Swift Package Manager, sin CocoaPods). Bundle ID: `com.sergiolopez.bitacora` (en `capacitor.config.ts`).

### Instalar en el iPhone (en el Mac)

```bash
npm install
npm run ios          # build web + copia a ios/ (cap sync)
npm run ios:abrir    # abre Xcode
```

En Xcode: target **App → Signing & Capabilities**, elige tu equipo de Apple Developer y ejecuta en el iPhone conectado, o **Product → Archive → Distribute → TestFlight** para instalarla desde TestFlight.

### Cómo se actualiza la app del iPhone

La app de iOS no lleva la web empaquetada: carga `https://bitacora-lophex.netlify.app` (`server.url` en `capacitor.config.ts`), el mismo sitio que se usa desde la computadora. Netlify compila y publica cada push a `main`, así que cada deploy llega al iPhone al abrir la app, sin reinstalar nada. Las variables de Supabase (`.env`) están configuradas en Netlify.

Sin conexión, Capacitor muestra `public/offline.html` (empaquetada en la app) y reintenta sola hasta que el sitio responde. Los datos siguen en el dispositivo (IndexedDB del sitio) y se sincronizan al volver la red.

En **Ajustes** se ve la versión de la web en uso con la fecha del commit.

### Cuándo hace falta recompilar en Xcode

Solo cuando cambia algo nativo: añadir o actualizar plugins de Capacitor, `capacitor.config.ts`, el icono, permisos de `Info.plist` o el widget. En ese caso sube `MARKETING_VERSION` en Xcode (p. ej. `1.0` → `1.1`) y distribuye por TestFlight.

Para probar en el iPhone un build local en vez del sitio publicado, comenta `server` en `capacitor.config.ts` y corre `npm run ios`.

## Sincronización (Supabase)

Proyecto `bitacora` (ref `gpneajxkshorrwwuljfo`, org Lophex, `us-east-1`).

- **Local primero.** La app siempre lee y escribe en IndexedDB; `src/data/sync` mueve los cambios por debajo. Sin cuenta o sin conexión, todo sigue funcionando.
- **Cuándo sincroniza:** al iniciar sesión, al abrir o volver a la app, al recuperar la conexión, 1,5 s después de cada cambio local, cuando Realtime avisa que otro dispositivo cambió algo y cada 5 minutos.
- **Cómo:** `MotorSync` baja lo que el servidor recibió desde el último cursor (`servidor_en`) y sube todo registro cuya versión local no coincide con la última que el servidor tiene (`versionesSync`). Gana la edición más reciente (`updatedAt`); el trigger del servidor descarta versiones viejas. Los borrados son lógicos y viajan como una edición más.
- **Esquema** (`supabase/migrations`): una tabla por entidad (`proyectos`, `tareas`, `notas`, `archivos`, `historial`) con la entidad completa en `datos` (jsonb), así un campo nuevo no requiere migración. RLS: cada usuario solo ve y escribe lo suyo; no hay borrado físico.
- **Archivos:** los datos del archivo (nombre, tipo, tamaño) viajan en la tabla `archivos` como cualquier entidad; el contenido va al bucket privado `archivos` de Storage, en `<user_id>/<archivo_id>`, y las políticas de `storage.objects` limitan cada cuenta a su carpeta. Al agregar un archivo se guarda primero en el dispositivo (tabla local `contenidos`, como bytes y con `subido` 0/1; no como Blob, porque WebKit puede vaciar o enviar con 0 bytes un Blob leído de IndexedDB) y `SubidaArchivos` lo sube después de sincronizar los datos. Los demás dispositivos no descargan nada por adelantado: lo abren con un enlace temporal (1 h). Máximo 50 MB por archivo (el límite del plan gratuito).
- **Cuenta:** en Ajustes → Cuenta y sincronización se entra con correo y contraseña. La primera vez (o si se olvida la contraseña) se entra con un código de 6 dígitos por correo; una cuenta sin contraseña recibe en ese momento el aviso «Crea tu contraseña». Como Supabase no expone si un usuario tiene contraseña, la app anota `contrasena_definida: true` en `user_metadata` al crearla. Mínimo 8 caracteres (`minimum_password_length`). El registro abierto está cerrado porque la clave publishable viaja dentro de la app: es pública por diseño y la seguridad la dan las RLS. Para dar acceso a otro correo, créalo en el panel (Authentication → Users → Add user).
- **Secretos:** `.env` (URL y clave publishable; copia `.env.example`) y `.env.local` (contraseña de la base) no se versionan. Netlify los tiene como variables de entorno del sitio. La clave secreta / `service_role` nunca entra al repositorio.
- Al cerrar sesión los datos se quedan en el dispositivo. Si entra otra cuenta, lo que hay en el dispositivo se sube a esa cuenta.
- El correo de Supabase sin SMTP propio permite pocos envíos por hora; para uso personal basta. Si hiciera falta, configura un SMTP en `[auth.email.smtp]`.

Para cambiar el esquema: crea `supabase/migrations/<fecha>_<nombre>.sql` y ejecuta `npm run db:push` (pide la contraseña de `.env.local` como `SUPABASE_DB_PASSWORD`).

## Arquitectura

```
src/
├── domain/        Tipos y lógica pura (deadlines, orden, progreso, resumen). Sin React ni Dexie.
├── data/
│   ├── repositories/   Interfaces (types.ts) + implementación Dexie (dexie/)
│   ├── hooks/          useTareas, useProyectos… (se suscriben a los repositorios)
│   ├── sync/           Sincronización con Supabase: motor, cliente, servicio y contexto
│   ├── resumen.ts      Resumen exportable de pendientes (widget / notificaciones)
│   └── RepositoryContext.tsx
├── i18n/          Diccionarios tipados es/en y proveedor de idioma
├── app/           Router, proveedores y layout
├── features/      Vistas: hoy/, proximos/, seguimiento/, proyectos/, todas/, tareas/ (fila, editor, acciones), notas/ y archivos/
├── ui/            Componentes base: Button, Campos, Sheet/Modal, Toast, Confirmar, Pagina…
├── hooks/         useAhora, useAtajos, useDeslizar
├── styles/        Tokens de diseño (claro/oscuro), safe areas y animaciones
└── lib/           Utilidades (ids, fechas, cn)
```

### Capa de datos

- Los componentes **nunca** importan Dexie: usan los hooks de `data/hooks`, que dependen solo de las interfaces de `data/repositories/types.ts`.
- La reactividad es neutral: cada repositorio expone `observar(filtro, alCambiar) → cancelar`. Dexie lo implementa con `liveQuery`; Supabase podrá hacerlo con Realtime.
- `crearRepositorios()` (`data/repositories/index.ts`) es el único lugar donde se elige la implementación.
- Entidades: proyectos (con cliente opcional), tareas, notas y archivos (estos dos, siempre dentro de un proyecto). Al eliminar un proyecto se eliminan sus notas y archivos.
- Todas las entidades tienen `id` (UUID), `createdAt`, `updatedAt` (ISO 8601 en UTC) y `eliminadoEn` para el **borrado lógico**, necesario para propagar borrados al sincronizar.
- En las operaciones de actualización, `null` borra un campo opcional y `undefined` lo deja como está.

### Seguimiento: "en la cancha de quién"

Cada tarea tiene `cancha`: `mia` (me toca a mí) o `cliente` (espero algo del cliente). Las reglas viven en el repositorio, no en la UI:

- Al pasar a `cliente` se anota `esperandoDesde`, que alimenta el contador «Cliente · N d».
- `seguimiento` es el día en que toca preguntarle al cliente; ese día la tarea aparece en **Hoy** («Dar seguimiento») y arriba en **Seguimiento**.
- Al volver a `mia` se borran `esperandoDesde` y `seguimiento`.

La vista **Seguimiento** separa «Del cliente» (lo que espera respuesta, agrupado por proyecto) y «Me toca» (lo pendiente de mi lado). En escritorio, cada fila tiene un botón para pasar la pelota; en móvil se cambia desde el editor.

La versión 2 del esquema IndexedDB añade la tabla `notas` y migra las tareas existentes a `cancha: 'mia'`. La versión 3 añade `historial`; la 4, los metadatos de sincronización, y la 5, `archivos` y `contenidos`.

### Checklist, historial y estimaciones

- **Checklist:** cada tarea puede tener pasos (`checklist`), guardados dentro de la propia tarea. La fila muestra el avance («2/5»).
- **Historial:** los repositorios anotan solos los hechos de cada proyecto (tareas creadas, completadas, eliminadas, cambios de fecha y de cancha, re-estimaciones, entrega) en la misma transacción que el cambio. Si un evento revierte al anterior de su misma familia en menos de 2 minutos (un «Deshacer»), se anulan los dos. Los **cambios solicitados** por el cliente se anotan a mano y son lo único que se puede borrar.
- **Entrega:** un proyecto tiene `inicio`, `entregaEstimada`, `entregaEstimadaInicial` (la primera estimación, que se fija sola) y `entregadoEn`.
- **Estadísticas** (`domain/estadisticas.ts`, pestaña en Proyectos): por proyecto, días estimados frente a reales, puntualidad, re-estimaciones, días esperando al cliente (se reconstruyen con el historial) y cambios. El **factor real** es la mediana de real/estimado de los proyectos entregados, y sirve para sugerir una entrega probable. Se aplica siempre sobre la estimación original.
- **Copiar estado:** desde el detalle del proyecto se genera un texto para el cliente (avance, lo listo, lo que sigue, lo pendiente de su parte) o uno interno que además incluye la estimación y los cambios. Se puede copiar o compartir.

### Archivos

La pestaña **Archivos** del proyecto guarda cotizaciones, contratos o lo que se haya entregado. Se suben con el botón o arrastrándolos (escritorio). En el navegador se abren desde la copia local si existe: PDF, imágenes y texto en una pestaña nueva, y el resto se descarga con su nombre. En la app de iOS siempre se abren con el enlace de la nube, en Safari (Capacitor manda ahí los `target="_blank"`), así que hace falta conexión y que el archivo ya esté subido. Eliminar es lógico y se puede deshacer; el contenido no se borra de Storage.

### Resumen exportable

`obtenerResumenPendientes(repos)` devuelve un JSON plano y versionado con las tareas vencidas, de hoy y de los próximos 7 días, más los conteos. `observarResumenPendientes` lo recalcula en cada cambio. Es lo que lee el widget de iOS y servirá para programar notificaciones locales.

### Widget de iOS

Widget de pantalla de inicio en tres tamaños: el pequeño muestra los conteos; el mediano y el grande, las tareas más urgentes (vencidas, hoy, próximos días) con el color de su proyecto. Tocar una tarea abre su editor en la app; tocar el resto abre Hoy.

- **Datos.** El widget corre en otro proceso y no puede leer IndexedDB. `src/lib/widget.ts` observa el resumen y, en iOS, lo entrega al plugin nativo `Widget` (`ios/App/App/WidgetPlugin.swift`), que lo escribe como `resumen.json` en el App Group `group.com.sergiolopez.bitacora` y pide a WidgetKit que redibuje. El plugin se registra en `BitacoraViewController`, el controlador raíz que crea `SceneDelegate`.
- **Frescura.** El JSON se actualiza solo mientras la app está abierta. El widget vuelve a clasificar las tareas por su deadline en cada refresco (cada deadline de hoy que se cumple y a medianoche), así que no se queda con el «hoy» de ayer; lo que no sabe es lo que cambió en otro dispositivo hasta que se abra la app en el iPhone.
- **Enlaces.** La app registra el esquema `bitacora://` (`Info.plist`). `interpretarEnlace` (`src/lib/widget.ts`) acepta `bitacora://hoy` y las demás vistas, `bitacora://tarea/<id>` y `bitacora://proyectos/<id>`; `useEnlacesExternos` los atiende, tanto si la app ya estaba abierta como si se lanzó con el enlace.
- **Código nativo.** El widget vive en `ios/App/BitacoraWidget` (`Resumen.swift` espeja el JSON y lo reclasifica; `BitacoraWidget.swift` son las vistas; `Textos.swift`, los textos en español e inglés según el idioma del sistema). Su `MARKETING_VERSION` debe coincidir con la de la app o App Store rechaza el binario.
- **Proyecto de Xcode.** `scripts/agregar-widget-xcode.rb` añade el target de la extensión, lo empaqueta en la app y pone los entitlements (requiere la gema `xcodeproj`, incluida con CocoaPods). Ya está aplicado; sirve si hay que regenerar `ios/` desde cero. En Xcode solo queda elegir el equipo de desarrollo en **Signing & Capabilities** de los dos targets (App y BitacoraWidget); con firma automática Xcode registra el App Group solo.
- **Sin plugin.** La web funciona igual en un binario antiguo: `hayWidget()` comprueba que el plugin exista antes de usarlo, así que no hace falta subir `nativoMinimo`.

Para probarlo: ejecuta la app en el iPhone o el simulador desde Xcode, abre la app una vez (eso escribe el primer resumen) y añade el widget «Pendientes» desde la pantalla de inicio. El target `BitacoraWidget` tiene previews de SwiftUI con datos de muestra.

### Idiomas

La interfaz está en español por defecto y puede cambiarse a inglés. Los textos viven en `src/i18n/es.ts` y `src/i18n/en.ts`; el inglés debe cumplir el tipo del español, así que una traducción faltante es un error de compilación. La elección se guarda como preferencia local.

## Diseño

- **Tokens** en `src/styles/index.css`: grises cálidos + acento índigo, redefinidos para modo oscuro con `prefers-color-scheme`. Úsalos vía Tailwind (`bg-superficie`, `text-texto-2`, `text-peligro`…), nunca colores sueltos.
- **Tipografía**: Inter Variable empaquetada localmente (funciona sin conexión en el WebView).
- **Escritorio**: barra lateral con conteos y proyectos, columnas laterales en Hoy y en el detalle de proyecto (≥1280px), acciones al pasar el cursor.
- **Móvil**: barra inferior, botón flotante de captura, formularios en bottom sheets (`<dialog>` nativo), deslizar una tarea a la derecha para completarla y a la izquierda para eliminarla, áreas táctiles de 44px y safe areas.
- **Deadlines "todo el día"**: una fecha sin hora se guarda a las 23:59 locales y se muestra sin hora.
- Las animaciones se desactivan con `prefers-reduced-motion`.

### Atajos de teclado

| Tecla | Acción |
| ----- | ------ |
| `N` | Nueva tarea (con los valores de la vista actual) |
| `1`–`5` | Hoy, Próximos, Seguimiento, Proyectos, Todas |
| `?` | Ajustes y lista de atajos |
| `⌘/Ctrl + Enter` | Guardar formulario |
| `Esc` | Cerrar panel |

## Probar la capa de datos a mano

Con `npm run dev` abierto, en la consola del navegador (solo en desarrollo):

```js
const p = await bitacora.repos.proyectos.crear({ nombre: 'Casa' })
await bitacora.repos.tareas.crear({ titulo: 'Comprar pintura', proyectoId: p.id, deadline: new Date().toISOString() })
await bitacora.repos.tareas.crear({ titulo: 'Llamar al dentista' })
await bitacora.resumen()
```

La lista de la página se actualiza sola. Los datos viven en IndexedDB (DevTools → Application → IndexedDB → `bitacora`).
