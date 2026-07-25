# Ruta Austral

PWA colaborativa y local-first para organizar un viaje por la Carretera Austral.
Funciona con conectividad intermitente, se instala en el teléfono y mantiene una
copia durable en el dispositivo antes de intentar sincronizar con Supabase.

## Qué incluye

- Itinerario final y propuestas separadas para Molina, Iñaki, Nef y Ross.
- Agenda por días, búsqueda, filtros, estados, responsables, costos y enlaces.
- Mapa con OpenStreetMap, geocodificación y lista offline de coordenadas.
- Gastos estimados/reales, división igual o personalizada y saldos sugeridos.
- Checklist, contactos, enlaces, adjuntos locales y clima cacheado.
- Deshacer/rehacer, snapshots de acciones destructivas y recuperación del sitio
  anterior.
- Exportación PDF, ICS, GPX, KML, GeoJSON y respaldo JSON versionado con los
  adjuntos locales disponibles.
- Temas claro/oscuro, navegación móvil, impresión y componentes accesibles.
- Instalación PWA, shell offline y actualizaciones solo con consentimiento.

El acceso compartido es deliberadamente simple: cualquiera con el enlace de la
aplicación puede editar. No hay cuentas ni contraseñas.

## Desarrollo

Requiere Node.js 22 o superior.

```powershell
npm install
npm run dev
```

Comandos de verificación:

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

Las pruebas E2E se ejecutan con `npm run test:e2e` después de instalar Chromium
y WebKit para Playwright. La configuración prueba móvil y escritorio.

## Datos y sincronización

IndexedDB (Dexie) es la fuente inmediata del dispositivo. Cada mutación guarda el
workspace y su operación pendiente en una sola transacción. Cuando vuelve la red,
las operaciones se aplican de forma idempotente en Supabase; una edición nueva
hecha mientras hay una petición en curso nunca se reemplaza por el snapshot que
está llegando.

La primera apertura también migra `carretera-austral-planner-v2` desde
`localStorage`. El blob original se conserva como recuperación. La versión
anterior queda disponible en `/legacy/index.html` en modo de solo lectura.

### Supabase

Las variables públicas son:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

No se debe usar una `service_role` en el navegador ni en Vercel.

Para operar la PWA basta aplicar
`supabase/migrations/202607180002_pwa_workspace_sync.sql`: contiene el contrato
exacto del cliente, acceso público por enlace e idempotencia. La migración
`202607180001_ruta_austral.sql` deja un modelo normalizado side-by-side y una
migración conservadora de `planner_state`; es opcional y no participa del flujo
actual.

El contrato y las consultas de comprobación están en
`supabase/PWA_SYNC_RUNBOOK.md`. La segunda migración tiene una prueba ejecutable
en PostgreSQL puro: `supabase/tests/workspace_sync.sql`.

## PWA y despliegue

Vite genera el manifest, iconos y un service worker `injectManifest`. El shell y
los assets de la aplicación se precargan; Supabase y las teselas de mapas siempre
pasan por red. Los adjuntos viven como `Blob` en IndexedDB y el clima usa una
copia explícita con fecha de actualización. El respaldo JSON incorpora esos
blobs como datos base64, informa cualquier archivo ausente y también acepta el
formato antiguo que sólo contenía el workspace. Los archivos eliminados se
conservan para Deshacer; la limpieza manual borra únicamente huérfanos sin
snapshots y con al menos 30 días de antigüedad.

`vercel.json` configura el fallback SPA y las cabeceras de caché. En Vercel:

- Framework: Vite.
- Build: `npm run build`.
- Output: `dist`.
- Añadir las dos variables públicas de Supabase si se quiere reemplazar la
  configuración de desarrollo incluida.

En iPhone, abrir el despliegue una vez con internet y usar **Compartir → Añadir a
pantalla de inicio**.

## Estructura

```text
src/domain/       tipos, normalización, seed y selectores puros
src/data/         IndexedDB, migración local, adjuntos y comandos
src/sync/         outbox, Supabase y Realtime
src/components/   sistema visual y componentes accesibles
src/features/     itinerario, mapa, gastos y centro operativo
src/exports/      PDF, calendario, geodatos y JSON
src/pwa/          registro y ciclo de actualización
supabase/         migraciones, runbooks y pruebas SQL
public/legacy/    aplicación anterior en modo recuperación
```
